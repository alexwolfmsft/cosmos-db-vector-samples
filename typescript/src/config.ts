// Structured configuration for the application
console.log(process.env);

export const config = {
    // Azure OpenAI configuration
    model_embedding: {
        apiKey: process.env.AZURE_OPENAI_EMBEDDING_KEY,
        apiVersion: process.env.AZURE_OPENAI_EMBEDDING_API_VERSION || '2023-05-15',
        endpoint: process.env.AZURE_OPENAI_EMBEDDING_ENDPOINT,
        model: process.env.AZURE_OPENAI_EMBEDDING_MODEL || 'text-embedding-ada-002',
        deployment: process.env.AZURE_OPENAI_EMBEDDING_MODEL || 'text-embedding-ada-002',
        embeddingModel: process.env.AZURE_OPENAI_EMBEDDING_MODEL || 'text-embedding-ada-002',
        batchSize: parseInt(process.env.EMBEDDING_BATCH_SIZE || '16', 10),
    },

    model_chat: {
        apiKey: process.env.AZURE_CHAT_KEY,
        apiVersion: process.env.AZURE_CHAT_API_VERSION || '2023-05-15',
        endpoint: process.env.AZURE_CHAT_ENDPOINT,
        model: process.env.AZURE_CHAT_KEY || 'text-chat-ada-002',
        deployment: process.env.AZURE_OPENAI_CHAT_MODEL || 'text-chat-ada-002',
        chatModel: process.env.AZURE_OPENAI_CHAT_MODEL || 'text-chat-ada-002',
        batchSize: parseInt(process.env.CHAT_BATCH_SIZE || '16', 10),
    },

    // Azure AI Project configuration
    project: {
        endpoint: process.env.PROJECT_ENDPOINT,
        key: process.env.PROJECT_KEY,
        modelEndpoint: process.env.MODEL_ENDPOINT,
        modelDeploymentName: process.env.MODEL_DEPLOYMENT_NAME || 'text-embedding-ada-002'
    },
    
    // Data file paths
    data: {
        file: process.env.DATA_FILE_WITHOUT_VECTORS || '../data/product.json',
        fileWithVectors: process.env.DATA_FILE_WITH_VECTORS || '../data/product3.json',
    },

    // Embedding configuration
    embeddings: {
        fieldToEmbed: process.env.FIELD_TO_EMBED || 'largeDescription',
        embeddedField: process.env.EMBEDDED_FIELD || 'text_embedding_ada_002',
        dimensions: parseInt(process.env.EMBEDDING_DIMENSIONS || '1536', 10),
        indexName: process.env.INDEX_NAME || 'vectorSearchIndex',
    },
    
    // MongoDB configuration
    mongodb: {
        connectionString: process.env.MONGO_CONNECTION_STRING || process.env.AZURE_COSMOS_MONGO_VCORE_RESOURCE_CONNECTION_STRING,
        dbName: process.env.MONGO_DB_NAME || 'cosmicworks',
        collectionName: process.env.MONGO_COLLECTION_NAME || 'products',
    },
    
    // Debug settings
    debug: process.env.DEBUG === "true" || false,

};
