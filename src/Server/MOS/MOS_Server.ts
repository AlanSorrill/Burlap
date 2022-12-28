
import { Db, MongoClient } from 'mongodb';
import { Burlap, MOS_PermissionPredicates, MOS_Protocol, SucketProtocol } from '../ServerImports'

export type MOS_Server_Options<DatabaseTypes extends {}, Protocol extends SucketProtocol> = {
    permissions: MOS_PermissionPredicates<DatabaseTypes, Protocol>
}
export class MOS_Server<DatabaseTypes extends {}, Protocol extends SucketProtocol> {
    burlap: Burlap<MOS_Protocol<DatabaseTypes>>
    mongoClient: MongoClient;
    private options: MOS_Server_Options<DatabaseTypes, Protocol>;
    constructor(options: MOS_Server_Options<DatabaseTypes, Protocol>, burlap: Burlap<Protocol>, mongoClient: MongoClient) {
        this.burlap = burlap as any;
        this.options = options;
        this.mongoClient = mongoClient;
        burlap.addProtocol<MOS_Protocol<any>>({
            defaultState() {
                return { userId: null }
            },
            reqRespListeners: {
                async onMosInitCollection(msg) {
                    return { type: 'Error', message: `Not yet implemented` }
                }
            },
            eventPredicates: {
                mosCollectionUpdate: (reg, packet, state) => (true)
            }
        })
        let ths = this;
        this.watchCancellers.push(this.burlap.on('clientEvtRegistrationChanged', (evt) => {
            if (evt.eventName == 'mosCollectionUpdate') {
                let mosDb = ths.databases.get(evt.registration.collectionId.dbName)
                if (!mosDb) {
                    if (evt.op != 'register') {
                        throw new Error(`Got op ${evt.op} for serverDb that doesn't exist`)
                    }
                    mosDb = new MOS_Server_Db(evt.registration.collectionId.dbName, ths);
                    ths.databases.set(evt.registration.collectionId.dbName, mosDb)
                }

                switch (evt.op) {
                    case 'register':
                        mosDb.registerCollection( evt.registration.collectionId.collectionName);
                        return;
                    case 'cancel':
                    // mosDb.cancel
                }
            }
        }))
    }
    databases: Map<string, MOS_Server_Db<any>> = new Map();
    watchCancellers: (() => void)[] = []
    onDestroy() {
        this.watchCancellers.forEach((cb) => cb())
    }

}
export class MOS_Server_Db<CollectionTypes extends {}> {
    registerCollection(collectionName: string) {
        throw new Error('Method not implemented.');
    }
    mosServer: MOS_Server<any, SucketProtocol>
    db: Db;
    constructor(dbName: string, mosServer: MOS_Server<any, SucketProtocol>) {
        this.mosServer = mosServer;
        this.db = mosServer.mongoClient.db(dbName);
        let ths = this;

    }
    watchCancellers: (() => void)[] = []

    onDestroy() {
        this.watchCancellers.forEach((cb) => cb())
    }
}