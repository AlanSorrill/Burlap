import { Burlap, copyCombine, DefaultProtocol, Protocol_GetEventNames, Protocol_GetEventPacketObj, Protocol_GetEventRegObj, Protocol_GetState, ServerSucketOptions, Sucket, SucketProtocol, SuckMSG, TransactionId } from './ServerImports'
import ws from 'ws'

// export type SucketOptions<Protocol extends SucketProtocol> = SucketOptions<Protocol> //& { defaultEventPredicates: SucketEventPredicate<DefaultSucketProtocol['eventTypes']> }

export function addServerOptions<Protocol extends SucketProtocol>(options: ServerSucketOptions<Protocol>, serverOptions: Omit<ServerSucketOptions<Protocol>, keyof ServerSucketOptions<Protocol>>): ServerSucketOptions<Protocol> {
    let out: any = {}
    for (let [k, v] of Object.entries(options)) {
        out[k] = v;
    }
    for (let [k, v] of Object.entries(serverOptions)) {
        out[k] = v;
    }
    return out;
}

export abstract class ServerSucket<Protocol extends SucketProtocol> extends Sucket<Protocol>{
    state: Protocol_GetState<Protocol>
    protected eventRegCounter = 0;
    protected eventRegistrations: Map<Protocol_GetEventNames<Protocol>, Map<string, Protocol_GetEventRegObj<Protocol, Protocol_GetEventNames<Protocol>>>> = new Map();
    options: ServerSucketOptions<Protocol>
    constructor(options: ServerSucketOptions<Protocol>) {
        super();
        this.options = options;
        if (Array.isArray(options.defaultState)) {
            this.state = options.defaultState[0]();
            for (let i = 1; i < options.defaultState.length; i++) {
                this.state = copyCombine(this.state as {}, options.defaultState[i]() as {}) as any;
            }
        } else {
            this.state = options.defaultState();
        }
    }
    emitEvent<EventName extends Protocol_GetEventNames<Protocol>>(eventName: EventName, packet: Protocol_GetEventPacketObj<Protocol, EventName>) {
        console.log(`Emitting ${eventName} event packet ${JSON.stringify(packet)}`)
        let evtMap = this.eventRegistrations.get(eventName);
        if (!evtMap) {
            console.log(`No event registrations for ${eventName}`)
            return;
        }
        let ths = this;
        let rejIds: string[] = [];
        let predicate = this.options.eventPredicates[eventName as any] as (reg, packet, state) => (boolean);
        if (!predicate) {
            throw new Error(`No event predicate found for ${eventName}`)
        }
        console.log(`Got predicate`)
        evtMap.forEach((rejObj, rejId) => {
            if (predicate(rejObj, packet, ths.state)) {
                rejIds.push(rejId)
            }
        })
        if (rejIds.length > 0) {
            this.sendSuckMsg({ suckType: 'eventPacket', message: packet as any, rejIds: rejIds })
        }
    }

    protected async onSuckMsg(msg: TransactionId<SuckMSG<Protocol>>) {
        switch (msg.suckType) {
            case 'eventRegisterRequestReq':
                console.log(`Event registration ${msg.eventName}`)
                let mapForEvent = this.eventRegistrations.get(msg.eventName);
                if (!mapForEvent) {
                    mapForEvent = new Map();
                    this.eventRegistrations.set(msg.eventName, mapForEvent);
                }
                let evtRegId = `${this.eventRegCounter++}${Date.now()}`
                mapForEvent.set(evtRegId, msg.regObject);
                this.sendSuckMsg({ suckType: 'eventRegisterRequestResp', evtRegId: evtRegId, success: true, transactionId: msg.transactionId })
                return;
            case 'eventUpdateRegReq':
                let mappForEvent = this.eventRegistrations.get(msg.eventName);
                if (!mappForEvent) {
                    this.sendSuckMsg({ suckType: 'eventUpdateRegResp', success: false, transactionId: msg.transactionId })
                    return;
                }
                let oldState = mappForEvent.get(msg.evtRegId)
                if (!oldState) {
                    this.sendSuckMsg({ suckType: 'eventUpdateRegResp', success: false, transactionId: msg.transactionId })
                    return;
                }
                for (let [k, v] of Object.entries(msg.regObject)) {
                    oldState[k] = v;
                }
                mappForEvent.set(msg.evtRegId, oldState)
                this.sendSuckMsg({ suckType: 'eventUpdateRegResp', success: true, transactionId: msg.transactionId })
                return;
            case 'eventCancel':

                if (!this.eventRegistrations.has(msg.eventName)) {
                    return;
                }
                this.eventRegistrations.get(msg.eventName)?.delete(msg.evtRegId)
                return;
            default:
                throw new Error(`Unknown message type ${msg.suckType}`);
        }

    }

}
export class ServerWebSucket<Protocol extends SucketProtocol> extends ServerSucket<Protocol>{

    socket: ws.WebSocket;
    id: string;
    burlap: Burlap<Protocol>;
    // options: SucketOptions<Protocol>

    constructor(id: string, socket: ws.WebSocket, options: ServerSucketOptions<Protocol>, burlap: Burlap<Protocol>) {
        super(options);
        this.id = id;
        this.socket = socket;
        this.burlap = burlap;
        let ths = this;
        socket.on('open', (ws) => {
            ths.emitLifecycleEvent('connect', {})
        })
        socket.on('message', (data: Buffer) => {
            let strMsg = data.toString();
            let objMsg = JSON.parse(strMsg);
            ths.handleSuckMsg(objMsg)
        })
        socket.on('close', (code, reason) => {
            ths.emitLifecycleEvent('disconnect', { code: code, reason: reason.toString() })
        })
        socket.on('error', (err) => {
            console.log(err.message)
            ths.emitLifecycleEvent('disconnect', { code: -1, reason: err.message })
        })
    }

    protected _sendSuckMsg(msg: SuckMSG<Protocol>): void {
        this.socket.send(JSON.stringify(msg))
    }
}