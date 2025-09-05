
import { MongoClient } from 'mongodb';

const config = {
    connectionString: process.env.MONGO_CONNECTION_STRING!,
    dbName: "HotelSet",
    collectionName: "hotels",
    embeddedField: process.env.EMBEDDED_FIELD!,
    embeddingDimensions: parseInt(process.env.EMBEDDING_DIMENSIONS!, 10),
    indexName: "vectorIndex_diskann"
};

const mongoSearchOptions = {
    kind: 'vector-diskann',
    dimensions: config.embeddingDimensions,
    similarity: 'COS', // 'COS', 'L2', 'IP'
    maxDegree: 20, // 20 - 2048,  edges per node
    lBuild: 10 // 10 - 500, candidate neighbors evaluated
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


main().catch(err => {
    console.error('Unhandled error:', err);
    process.exitCode = 1;
});
