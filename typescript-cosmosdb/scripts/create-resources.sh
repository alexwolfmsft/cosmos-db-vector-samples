#!/bin/bash
# chmod +x create-resources.sh

# Set your variables
SUBSCRIPTION_ID="b57b253a-e19e-4a9c-a0c0-a5062910a749" #"<your-subscription-id>"
RESOURCE_GROUP="vector-nosql-3" #"<your-resource-group>"
LOCATION="westus3" #"<your-location>" # e.g., eastus
COSMOS_ACCOUNT_NAME="dfberry-nosql-3" #"<your-cosmos-account-name>"

# Set subscription
az account set --subscription "$SUBSCRIPTION_ID"

# Create resource group
az group create --name "$RESOURCE_GROUP" --location "$LOCATION"

# Create Cosmos DB NoSQL account
az cosmosdb create \
	--name "$COSMOS_ACCOUNT_NAME" \
	--resource-group "$RESOURCE_GROUP" \
	--kind GlobalDocumentDB \
	--locations regionName="$LOCATION" 

# Enable NoSQL Vector Search capability
az cosmosdb update \
	--resource-group "$RESOURCE_GROUP" \
	--name "$COSMOS_ACCOUNT_NAME" \
	--capabilities EnableNoSQLVectorSearch