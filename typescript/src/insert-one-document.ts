import { MongoClient, Document } from 'mongodb';
import { v4 as uuidv4 } from 'uuid';
import { config } from './config.js';

// Type for our document
interface ProductDocument extends Document {
  _id: string;
  name: string;
}

// Use the connection string from our config
const connectionString = config.mongodb.connectionString;
console.log(`Connection string available: ${connectionString ? 'Yes' : 'No'}`);
if(!connectionString) {
  throw new Error('Connection string is not defined');
}

// Main function to wrap the async code
async function main() {
  // Create a MongoDB client
  const client = new MongoClient(connectionString as string);

  try {
    // Connect to the MongoDB server
    await client.connect();
    console.log('Connected to MongoDB');

    // Get database reference (will be created if it doesn't exist)
    const database = client.db(config.mongodb.dbName);
    
    // Get collection reference (will be created if it doesn't exist)
    const collection = database.collection<ProductDocument>('test');
    
    // Generate UUID string for our document
    const uuidString = uuidv4();
    console.log(`Generated UUID: ${uuidString}`);
    
    // Document to insert with regular string as _id
    const item: ProductDocument = {
      _id: uuidString, // Plain string UUID instead of MongoDB's ObjectId
      name: 'Kiama classic surfboard'
    };
    
    // Insert the document with our UUID string
    // Cast to any to bypass TypeScript's type checking for _id
    const result = await collection.insertOne(item as any);
    console.log(`Document inserted with _id: ${result.insertedId}`);
    
    // Retrieve the document we just inserted
    // Cast to any to bypass TypeScript's type checking for _id
    const retrievedDoc = await collection.findOne({ _id: uuidString } as any);
    
    // Transform the document to rename _id to id for display
    if (retrievedDoc) {
      // Create a new object with id instead of _id
      const transformedDoc = {
        id: retrievedDoc._id,
        name: retrievedDoc.name
      };
      
      console.log('\nRetrieved and transformed document:');
      console.log(JSON.stringify(transformedDoc, null, 2));
    }
    
    // Alternative approach using MongoDB's projection to rename fields
    const renamedDoc = await collection.findOne(
      { _id: uuidString } as any,
      { projection: { _id: 0, id: '$_id', name: 1 } }
    );
    
    console.log('\nRetrieved document with renamed fields using projection:');
    console.log(JSON.stringify(renamedDoc, null, 2));
    
  } catch (error: any) {
    console.error('Error:', error.message);
  } finally {
    // Close the connection when done
    await client.close();
    console.log('Connection closed');
  }
}

// Run the main function
main();