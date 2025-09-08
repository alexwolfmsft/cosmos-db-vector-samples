# Azure Cosmos DB Vector Search with MongoDB API

This document explains how to use the embedding functionality provided in this project to enable vector search in Azure Cosmos DB with MongoDB API.

## Overview

Vector search allows you to find documents based on semantic similarity rather than exact keyword matches. This is particularly useful for:

- Semantic search of text documents
- Recommendation systems
- Finding similar products
- Question answering systems

This project provides utilities to:

1. Generate embeddings for documents using Azure OpenAI
2. Store these embeddings in MongoDB (Cosmos DB MongoDB vCore)
3. Perform vector searches using these embeddings

## Key Components

### 1. `create-embeddings.ts`

The core module that provides functionality to generate embeddings from document fields:

- `createEmbeddingBatch()`: Processes a batch of documents, extracts a specified field, generates embeddings using Azure OpenAI, and adds the embeddings back to the documents

### 2. Example Files

Two example files demonstrate how to use the embedding functionality:

- `embedding-example.ts`: Shows how to generate embeddings for sample documents and demonstrates basic vector search
- `process-collection-embeddings.ts`: Shows how to process an existing MongoDB collection, add embeddings to all documents, and update them in place

## Configuration

The embedding functionality relies on configuration defined in `config.ts`:

```typescript
// Configuration example
const config = {
  project: {
    key: process.env.AZURE_OPENAI_API_KEY
  },
  model_embedding: {
    endpoint: process.env.AZURE_OPENAI_ENDPOINT,
    deployment: process.env.AZURE_OPENAI_EMBEDDING_DEPLOYMENT,
    apiVersion: process.env.AZURE_OPENAI_API_VERSION,
    batchSize: 16
  },
  mongodb: {
    connectionString: process.env.MONGODB_CONNECTION_STRING,
    dbName: process.env.MONGODB_DATABASE_NAME,
    collectionName: process.env.MONGODB_COLLECTION_NAME
  },
  embeddings: {
    dimensions: 1536, // Depends on the model used
    similarity: "cosine" // Vector similarity metric
  }
}
```

## Getting Started

### Prerequisites

1. An Azure OpenAI resource with an embedding model deployed
2. A Cosmos DB account with MongoDB vCore API
3. Proper environment variables set in `.env`

### Running the Examples

1. Generate embeddings for sample documents:

```bash
npx ts-node src/examples/embedding-example.ts
```

2. Process an existing MongoDB collection to add embeddings:

```bash
npx ts-node src/examples/process-collection-embeddings.ts
```

## Performing Vector Searches

Once you have documents with embeddings stored in your MongoDB collection, you can perform vector searches using the MongoDB aggregation pipeline:

```typescript
// First get an embedding for your search query
const searchText = "wireless headphones";
const searchEmbedding = await getEmbeddingForText(searchText);

// Then perform the vector search
const searchResults = await collection.aggregate([
  {
    $search: {
      vectorSearch: {
        path: "embedding",
        queryVector: searchEmbedding,
        numCandidates: 100,
        limit: 10
      }
    }
  },
  {
    $project: {
      _id: 1,
      name: 1,
      description: 1,
      category: 1,
      price: 1,
      score: { $meta: "searchScore" }
    }
  }
]).toArray();
```

## Best Practices

1. **Batch Processing**: Always process documents in batches to avoid memory issues and respect API rate limits
2. **Error Handling**: Implement robust error handling, especially for network operations
3. **Index Creation**: Create a vector index in your MongoDB collection for optimal performance:

```javascript
db.collection.createIndex(
  { embedding: "vector" },
  { 
    name: "vector_index",
    vectorDimension: 1536, // Match your embedding dimensions
    vectorDistanceMetric: "cosine" // Match your similarity metric
  }
)
```

4. **Field Selection**: Choose meaningful fields for embedding that capture the semantic content you want to search

## Troubleshooting

- **Memory Issues**: Reduce batch size if you encounter memory problems
- **Rate Limiting**: Add delays between API calls if you hit rate limits
- **Missing Fields**: Implement fallbacks for documents missing the field to embed
- **Type Errors**: Use proper TypeScript interfaces and type assertions when working with MongoDB documents
