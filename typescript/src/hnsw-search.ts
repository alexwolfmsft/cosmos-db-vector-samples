import { MongoClient } from 'mongodb';
import { AzureOpenAI } from 'openai/index.js';

const config = {
    connectionString: process.env.MONGO_CONNECTION_STRING!,
    dbName: "HotelSet_hnsw",
    collectionName: process.env.MONGO_COLLECTION!,
    embeddedField: process.env.EMBEDDED_FIELD!,
    embeddingDimensions: parseInt(process.env.EMBEDDING_DIMENSIONS!, 10),
    queryFileWithVectors: process.env.QUERY_FILE_WITH_VECTORS!,
    indexName: "vectorIndex_hnsw"
};

const apiKey = process.env.AZURE_OPENAI_EMBEDDING_KEY!;
const apiVersion = process.env.AZURE_OPENAI_EMBEDDING_API_VERSION!;
const endpoint = process.env.AZURE_OPENAI_EMBEDDING_ENDPOINT!;
const deployment = process.env.AZURE_OPENAI_EMBEDDING_MODEL!;

const dbClient = new MongoClient(config.connectionString, {
    maxPoolSize: 5,
    minPoolSize: 1,
    maxIdleTimeMS: 30000,
    connectTimeoutMS: 30000,
    socketTimeoutMS: 360000
});

const aiClient = new AzureOpenAI({
    apiKey,
    apiVersion,
    endpoint,
    deployment
});

async function main(): Promise<void> {

    const query = "find a hotel by a lake with a mountain view";

    try {
        console.log('Starting vector similarity search...');

        await dbClient.connect();
        const db = dbClient.db(config.dbName);
        const collection = db.collection(config.collectionName);

        const response = await aiClient.embeddings.create({
            model: deployment,
            input: [query]
        });

        // Build the aggregation pipeline with $search stage
        const pipeline = [
            {
                $search: {
                    cosmosSearch: {
                        vector: response.data[0].embedding,
                        path: config.embeddedField,
                        k: 5
                    }
                }
            }
        ];

        // Execute the aggregation pipeline
        const results = await collection.aggregate(pipeline).toArray();

        if (results) {
            console.log(`Raw results: ${JSON.stringify(results, null, 2)}`);

            // Process results to combine document fields with score
            const processedResults = results.map(result => {
                // Extract the document and score
                const { document, score } = result as any;

                // Return combined object with all document fields and score
                return {
                    ...document,
                    score
                };
            });

            processedResults.forEach((result, index) => {
                console.log(`${index + 1}. HotelName: ${result.HotelName}, Score: ${result.score.toFixed(4)}`);
                //console.log(`   Description: ${result.Description}`);
            });

        }

    } catch (error: any) {
        console.error('Search demo failed:', error.message);
        process.exitCode = 1;
    } finally {
        console.log('Search demo completed');
        await dbClient.close();
    }
}

main().catch(err => {
    console.error('Unhandled error in search demo:', err);
    process.exitCode = 1;
});