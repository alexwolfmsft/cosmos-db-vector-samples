import { MongoClient, Db } from 'mongodb';

const config = {
    connectionString: process.env.MONGO_CONNECTION_STRING!,
    dbName: "HotelSet_hnsw",
    collectionName: process.env.MONGO_COLLECTION!,
    embeddedField: process.env.EMBEDDED_FIELD!,
    embeddingDimensions: parseInt(process.env.EMBEDDING_DIMENSIONS!, 10),
    indexName: "vectorIndex_hnsw"
};
const mongoSearchOptions = {
    kind: 'vector-hnsw',
    m: 16, // 2 - 100, default = 16, number of connections per layer
    efConstruction: 64, // 4 - 1000, default=64, size of the dynamic candidate list for constructing the graph
    similarity: 'COS', // 'COS', 'L2', 'IP'
    dimensions: config.embeddingDimensions
};

async function main(): Promise<void> {

    const client = new MongoClient(config.connectionString, {
        maxPoolSize: 5,
        minPoolSize: 1,
        maxIdleTimeMS: 30000,
        connectTimeoutMS: 30000,
        socketTimeoutMS: 360000
    });

    try {
        await client.connect();
        const db = client.db(config.dbName);

        const commandOptions = {
            createIndexes: config.collectionName,
            indexes: [
                {
                    name: config.indexName,
                    key: {
                        [config.embeddedField]: 'cosmosSearch'
                    },
                    cosmosSearchOptions: mongoSearchOptions
                }
            ]
        };

        await db.command(commandOptions);

    } catch (err) {
        console.error('Vector index operation failed:', String(err));
        process.exitCode = 1;
    } finally {
        console.log('Closing database connection...');
        await client.close();
        console.log('Database connection closed');
    }
}

// Execute the index creation function
main().catch(err => {
    console.error('Unhandled error:', err);
    process.exitCode = 1;
});
