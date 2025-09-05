import { MongoClient } from 'mongodb';
import { AzureOpenAI } from 'openai/index.js';

export function getClients(): { aiClient: AzureOpenAI; dbClient: MongoClient } {
    const apiKey = process.env.AZURE_OPENAI_EMBEDDING_KEY!;
    const apiVersion = process.env.AZURE_OPENAI_EMBEDDING_API_VERSION!;
    const endpoint = process.env.AZURE_OPENAI_EMBEDDING_ENDPOINT!;
    const deployment = process.env.AZURE_OPENAI_EMBEDDING_MODEL!;
    const aiClient = new AzureOpenAI({
        apiKey,
        apiVersion,
        endpoint,
        deployment
    });
    const dbClient = new MongoClient(process.env.MONGO_CONNECTION_STRING!, {
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

    return { aiClient, dbClient };
}