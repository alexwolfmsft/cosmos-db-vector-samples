import { MongoClient } from 'mongodb';
import { promises as fs}  from 'fs';
import path from 'path';
import { readFileReturnJson } from './files.js';

// ESM specific features - create __dirname equivalent
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const config = {
    connectionString: process.env.MONGO_CONNECTION_STRING!,
    dbName: "HotelSet",
    collectionName: "hotels",
    dataFile: process.env.DATA_FILE_WITH_VECTORS!,
    batchSize: parseInt(process.env.LOAD_SIZE_BATCH! || '100', 10),
    embeddingField: process.env.EMBEDDED_FIELD!,
    embeddingDimensions: parseInt(process.env.EMBEDDING_DIMENSIONS!, 10)
};

const indexColumns = [
    "HotelId",
    "Category",
    "Description",
    "Description_fr"
];

async function processBatches(collection, data) {
    console.log(`Processing in batches of ${config.batchSize}...`);
    const totalBatches = Math.ceil(data.length / config.batchSize);

    let inserted = 0;
    let updated = 0;
    let skipped = 0;
    let failed = 0;

    for (let i = 0; i < totalBatches; i++) {
        const start = i * config.batchSize;
        const end = Math.min(start + config.batchSize, data.length);
        const batch = data.slice(start, end);

        console.log(`Processing batch ${i + 1}/${totalBatches} (${batch.length} data)...`);

        // Use bulkWrite for optimal performance
        const operations = batch.map(data => ({
            updateOne: {
                filter: { _id: data._id },
                update: { $set: data },
                upsert: true  // Create if doesn't exist
            }
        }));

        try {
            const result = await collection.bulkWrite(operations);
            inserted += result.upsertedCount || 0;
            updated += result.modifiedCount || 0;
            skipped += batch.length - (result.upsertedCount + result.modifiedCount);

            console.log(`Batch ${i + 1} complete: ${result.upsertedCount} inserted, ${result.modifiedCount} updated`);
        } catch (error) {
            console.error(`Error in batch ${i + 1}:`, error);
            failed += batch.length;
        }

        // Small pause between batches to reduce resource contention
        if (i < totalBatches - 1) {
            await new Promise(resolve => setTimeout(resolve, 100));
        }
    }

    return { total: data.length, inserted, updated, skipped, failed };
}

/**
 * Main function to load data into MongoDB
 */
async function main() {
    console.log('Starting data load process...');
    const client = new MongoClient(config.connectionString, {
        // Performance optimizations
        maxPoolSize: 10,         // Limit concurrent connections
        minPoolSize: 1,          // Maintain at least one connection
        maxIdleTimeMS: 30000,    // Close idle connections after 30 seconds
        connectTimeoutMS: 30000, // Connection timeout
        socketTimeoutMS: 360000, // Socket timeout (for long-running operations)
        writeConcern: {          // Optimize write concern for bulk operations
            w: 1,                // Acknowledge writes after primary has written
            j: false             // Don't wait for journal commit
        }
    });

    try {
        await client.connect();
        const db = client.db(config.dbName);
        const collection = await db.createCollection(config.collectionName);
        const data = await readFileReturnJson(path.join(__dirname, "..", config.dataFile));

        for (const col of indexColumns) {
            const indexSpec = {};
            indexSpec[col] = 1; // Ascending index
            await collection.createIndex(indexSpec);
        }

        // Process data in batches
        const summary = await processBatches(collection, data);

        // Print summary
        console.log('\nData load summary:');
        console.log(`- Total data processed: ${summary.total}`);
        console.log(`- Inserted: ${summary.inserted}`);
        console.log(`- Updated: ${summary.updated}`);
        console.log(`- Skipped (already exists): ${summary.skipped}`);
        console.log(`- Failed: ${summary.failed}`);

        console.log('\nData load completed successfully!');

    } catch (error) {
        console.error('Data load failed:', error);
        process.exitCode = 1;
    } finally {
        console.log('Closing database connection...');
        await client.close();
        console.log('Database connection closed');
    }
}

// Execute the main function
main().catch(error => {
    console.error('Unhandled error:', error);
    process.exitCode = 1;
});