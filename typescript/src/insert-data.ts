export async function insertData(config, collection, data) {
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

        try {
            const result = await collection.insertMany(batch, { ordered: false });
            inserted += result.insertedCount || 0;
            console.log(`Batch ${i + 1} complete: ${result.insertedCount} inserted`);
        } catch (error: any) {
            if (error?.writeErrors) {
                // Some documents may have been inserted despite errors
                console.error(`Error in batch ${i + 1}: ${error?.writeErrors.length} failures`);
                failed += error?.writeErrors.length;
                inserted += batch.length - error?.writeErrors.length;
            } else {
                console.error(`Error in batch ${i + 1}:`, error);
                failed += batch.length;
            }
        }

        // Small pause between batches to reduce resource contention
        if (i < totalBatches - 1) {
            await new Promise(resolve => setTimeout(resolve, 100));
        }
    }
    const indexColumns = [
        "HotelId",
        "Category",
        "Description",
        "Description_fr"
    ];
    for (const col of indexColumns) {
        const indexSpec = {};
        indexSpec[col] = 1; // Ascending index
        await collection.createIndex(indexSpec);
    }

    return { total: data.length, inserted, updated, skipped, failed };
}