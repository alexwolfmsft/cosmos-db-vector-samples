export function printSearchResults(insertSummary, indexSummary, searchResults) {
    console.log('--- Summary ---');
    console.log(`Data Load: ${JSON.stringify(insertSummary)}`);
    console.log(`Index Creation: ${JSON.stringify(indexSummary)}`);
    //console.log(`Search Results: ${JSON.stringify(searchResults)}`);
    if (searchResults) {
        //console.log(`Raw results: ${JSON.stringify(searchResults, null, 2)}`);

        // Process results to combine document fields with score
        const processedResults = searchResults.map(result => {
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
}