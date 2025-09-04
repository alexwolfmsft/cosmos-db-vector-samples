/**
 * Data loading script for CosmicWorks data into Cosmos DB MongoDB vCore
 * Optimized for performance and cost-effectiveness
 */

import { MongoClient } from 'mongodb';
import { promises as fs}  from 'fs';
import path from 'path';

// ESM specific features - create __dirname equivalent
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Configuration
const config = {
    connectionString: process.env.MONGO_CONNECTION_STRING!,
    dbName: process.env.MONGO_DB_NAME!,
    collectionName: process.env.MONGO_COLLECTION_NAME!,
    dataFile: process.env.DATA_FILE_WITH_VECTORS!,
    batchSize: parseInt(process.env.LOAD_SIZE_BATCH! || '100', 10),
    embeddingField: process.env.EMBEDDED_FIELD!,
    embeddingDimensions: parseInt(process.env.EMBEDDING_DIMENSIONS!, 10)
};

const dataFilePath = path.join(__dirname, "..",config.dataFile);
console.log(`Data file path: ${dataFilePath}`);
console.log(`Collection name: ${config.collectionName}`);

/**
 * Create MongoDB client with optimized settings
 * @returns {MongoClient} Configured MongoDB client
 */
function createMongoClient() {
    // Validate configuration
    if (!config.connectionString) {
        throw new Error('COSMOS_CONNECTION_STRING environment variable is required');
    }

    return new MongoClient(config.connectionString, {
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
}

/**
 * Setup collection and ensure it exists
 * @param {Db} db - MongoDB database instance
 * @returns {Promise<Collection>} MongoDB collection
 */
async function setupCollection(db) {
    // Check if collection exists, create if not with optimal settings
    const collections = await db.listCollections({ name: config.collectionName }).toArray();

    let collection;
    if (collections.length === 0) {
        console.log(`Creating collection ${config.collectionName}...`);
        // Create collection with optimal settings for vector search
        await db.createCollection(config.collectionName);
    }

    return db.collection(config.collectionName);
}

/**
 * Load data from JSON file
 * @returns {Promise<Array>} Array of data
 */
async function loadData() {
    console.log(`Reading data from ${dataFilePath}...`);
    const rawData = await fs.readFile(dataFilePath, 'utf8');
    let data;

    try {
        data = JSON.parse(rawData);
    } catch (error:any ) {
        throw new Error(`Failed to parse JSON data: ${error.message}`);
    }

    if (!Array.isArray(data)) {
        throw new Error('Data file must contain an array of data');
    }

    console.log(`Found ${data.length} items to import`);

    // Ensure each item has an _id field to prevent auto-generation
    return data.map(item => ({
        ...item,
        _id: item._id || item.id || String(Math.floor(Math.random() * 1000000))
    }));
}

/**
 * Create regular indexes for optimized querying
 * @param {Collection} collection - MongoDB collection
 */
async function createRegularIndexes(collection) {
    console.log('Creating regular indexes...');
    await collection.createIndex({ "_id": 1 });
    await collection.createIndex({ "name": 1 });
    await collection.createIndex({ "category": 1 });

    // Add indexes for embedding and largeDescription fields
    await collection.createIndex({ "largeDescription": "text" });  // Text index for full-text search on descriptions

    console.log('Regular indexes created successfully');
}


/**
 * Process data in batches for better performance
 * @param {Collection} collection - MongoDB collection
 * @param {Array} data - Array of data to process
 * @returns {Object} Summary of processing results
 */
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
    const client = createMongoClient();

    try {
        // Connect to MongoDB
        console.log('Connecting to database...');
        await client.connect();
        console.log('Connected to database');

        const db = client.db(config.dbName);
        const collection = await setupCollection(db);
        const data = await loadData();

        // Create standard indexes
        await createRegularIndexes(collection);

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