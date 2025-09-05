set AZURE_COSMOS_EMULATOR_ENABLE_DATA_PERSISTENCE=true

docker run \
    --publish 8081:8081 \
    --publish 10250-10255:10250-10255 \
    --name linux-emulator \
    --detach \
    mcr.microsoft.com/cosmosdb/linux/azure-cosmos-emulator:latest

curl --insecure https://localhost:8081/_explorer/emulator.pem > ~/emulatorcert.crt

cp ~/emulatorcert.crt /usr/local/share/ca-certificates/

sudo update-ca-certificates