import pkg from "node-opcua-client";
const {
  AttributeIds,
  BrowseDirection,
  ClientMonitoredItem,
  ClientSubscription,
  DataValue,
  makeBrowsePath,
  MessageSecurityMode,
  NodeClassMask,
  OPCUAClient,
  ResultMask,
  SecurityPolicy,
  TimestampsToReturn,
} = pkg;
import express from "express";
import http from "http";
import { Server as SocketServer } from "socket.io";

//Setup express e socket
const app = express();
const httpServer = http.createServer(app);
const io = new SocketServer(httpServer);
app.use(express.static("public")); //cartella per file web

const PORT = 3000;
httpServer.listen(PORT, () => console.log("server attivo"));

const connectionStrategy = {
  initialDelay: 1000,
  maxRetry: 1
}

const client = OPCUAClient.create({
  applicationName: "MyClient",
  connectionStrategy: connectionStrategy,
  securityMode: MessageSecurityMode.None,
  securityPolicy: SecurityPolicy.None,
  endpointMustExist: false
});
const endpointUrl = "opc.tcp://192.168.80.100:4840";


async function main() {
  try {
    // step 1 : Mi connetto
    await client.connect(endpointUrl);
    console.log("connesso");

    // step 2 : Creo la sessione
    const session = await client.createSession();
    console.log("sessione creata");


    const browseResult = await session.browse({
      nodeId: "ns=4;i=1",
      referenceTypeId: "Organizes",
      includeSubtypes: true,
      nodeClassMask: NodeClassMask.Object | NodeClassMask.Variable,
      browseDirection: BrowseDirection.Forward,
      resultMask: ResultMask.BrowseName | ResultMask.DisplayName | ResultMask.NodeClass | ResultMask.TypeDefinition
    });
    if (!browseResult.references){
      console.log("error");
    }
    else{
      console.log("references");
    for (const reference of browseResult.references){
      console.log(reference.browseName.toString());
    }

    }
    
    /* step 3' : Leggo una variabile con read
    const dataValue = await session.read({
        nodeId: "ns=4;i=2",
        attributeId: AttributeIds.Value
    });
    console.log("valore = ", dataValue.toString());*/

    // step 4: Installo una sottoscrizione e monitoro un singolo elemento
    /*const subscription = await session.createSubscription2({
       requestedPublishingInterval: 1000,
       requestedLifetimeCount: 100,
       requestedMaxKeepAliveCount: 10,
       maxNotificationsPerPublish: 100,
       publishingEnabled: true,
       priority: 10
    });

    subscription
        .on("keepalive", function() {
            console.log("keepalive");
        })
        .on("terminated", function() {
            console.log("terminated");
        });

       const itemToMonitor = {
        nodeId: "ns=4;i=2",
        attributeId: AttributeIds.Value
    };
    const parameters = {
      samplingInterval: 100,
      discardOldest: true,
      queueSize: 10
    };
    const monitoredItem = await subscription.monitor(
      itemToMonitor,
      parameters,
      TimestampsToReturn.Both
    );
    monitoredItem.on("changed", (dataValue: any) => {
      console.log("valore cambiato: ", dataValue.value.toString());
    });
        await new Promise(resolve => setTimeout(resolve,10000));
        await subscription.terminate();
        console.log("sub terminated");*/

    // step 5: installo una sottoscrizione e monitoro più elementi
    const itemsToMonitor = [
        "ns=4;i=2",
        "ns=4;i=3",
        "ns=4;i=4"
       ];

       const parameters = { 
        samplingInterval: 100, 
        discardOldest: true, 
        queueSize: 10 };

    const subscription = await session.createSubscription2({
       requestedPublishingInterval: 1000,
       requestedLifetimeCount: 100,
       requestedMaxKeepAliveCount: 10,
       maxNotificationsPerPublish: 100,
       publishingEnabled: true,
       priority: 10
    });

    subscription
        .on("keepalive", function() {
            console.log("keepalive");
        })
        .on("terminated", function() {
            console.log("terminated");
        });

       
       for (const ids of itemsToMonitor){
        const itemInfo = await session.read(
          {nodeId: ids, attributeId: AttributeIds.BrowseName});
        const name = itemInfo.value.value.name;
        const monitoredItem = await subscription.monitor(
          {nodeId: ids, attributeId: AttributeIds.Value},
          parameters,
          TimestampsToReturn.Both
        );
        monitoredItem.on("changed", (dataValue: any) => {
        console.log(name,' ha valore ', dataValue.value.value);
        const varvalue = dataValue.value.value;
        const timestamp = new Date().toLocaleTimeString();

        io.emit("update", { name, varvalue, timestamp} );
       });
    }
        await new Promise(resolve => setTimeout(resolve,10000));
        await subscription.terminate();
        console.log("sottoscrizione terminata");



    // Chiudo la sessione
    await session.close();

    // Mi disconnetto
    await client.disconnect();
    console.log("disconnesso");
  } catch(err) {
    console.log("c'è stato un errore : ",err);
  }
}

main();