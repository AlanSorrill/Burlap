import { capitalizeFirstLetter, ClientSucketOptions, Protocol_GetEventHandle, Protocol_GetEventNames, Protocol_GetEventPacketObj, Protocol_GetEventRegObj, Sucket, SucketProtocol, SuckMSG, TransactionId } from './ClientImports'

export abstract class ClientSucket<Protocol extends SucketProtocol> extends Sucket<Protocol>{
    options: ClientSucketOptions<Protocol>
    constructor(options: ClientSucketOptions<Protocol>) {
        super();
        this.options = options;
    }
    
    protected async onSuckMsg(msg: TransactionId<SuckMSG<Protocol>>) {
        switch (msg.suckType) {
            case 'reqResReq':
                let listenerKey = `on${capitalizeFirstLetter(msg.message['type'].substring(0, msg.message['type'].length - 3))}`
                let listener: (msg: any) => (Promise<any>) = this.options.reqRespListeners[listenerKey];
                if (typeof listener == 'undefined') {
                    console.error(`Failed to find listener for ${listenerKey}`, listener)

                    return;
                }
                console.log(`Responding to reqResp ${msg.message['type']} with listener ${listenerKey}`, listener)
                let result = await listener(msg.message);
                this.sendSuckMsg({ suckType: 'reqResResp', transactionId: msg.transactionId, message: result })
                return;
            case 'eventPacket':
                for(let regId of msg.rejIds){
                    this.eventCallbacks.get(regId)?.(msg.message)
                }
                return;
            default:
                throw new Error(`Unknown message type ${msg.suckType}`);
        }
    }

    private eventCallbacks: Map<string, (packet: Protocol_GetEventPacketObj<Protocol, Protocol_GetEventNames<Protocol>>) => void> = new Map();
    async on<EventName extends Protocol_GetEventNames<Protocol>>(eventName: EventName, regObj: Protocol_GetEventRegObj<Protocol, EventName>, callback: (packet: Protocol_GetEventPacketObj<Protocol, EventName>) => void): (Promise<Protocol_GetEventHandle<Protocol, EventName> | null>) {
        let resp = await this.sendSuckMsgRoundTrip({ suckType: 'eventRegisterRequestReq', eventName: eventName, regObject: regObj as any })
        if (resp.suckType != 'eventRegisterRequestResp') {
            throw new Error(`Unexpected response type to eventRegisterRequest: ${resp.suckType}`)
        }
        if (!resp.success) {
            return null;
        }
        let regId = resp.evtRegId;
        this.eventCallbacks.set(regId, callback as any);
        let ths = this;
        return {
            cancel() {
                ths.sendSuckMsg({ suckType: 'eventCancel', evtRegId: regId, eventName: eventName })
                ths.eventCallbacks.delete(regId);
            },
            async updateRegistration(edit) {
                let resp = await ths.sendSuckMsgRoundTrip({ suckType: 'eventUpdateRegReq', eventName: eventName, evtRegId: regId, regObject: edit as any })
                if (resp.suckType != 'eventUpdateRegResp') {
                    throw new Error(`Unexpected response to eventUpdateReq: ${resp.suckType}`)
                }
                return resp.success
            },
        } as {
            cancel: () => void,
            updateRegistration: (edit: Partial<Protocol_GetEventRegObj<Protocol, EventName>>) => Promise<boolean>
        } as any;
    }

}
export class ClientWebSucket<Protocol extends SucketProtocol> extends ClientSucket<Protocol>{

    socket: WebSocket;
    static reconnectDelay: number = 500;
    private constructor(options: ClientSucketOptions<Protocol>) {
        super(options);
    }
    public static async Create<Protocol extends SucketProtocol>(url: string, options: ClientSucketOptions<Protocol>) {
        let out = new ClientWebSucket(options);
        await out.connect(url);
        return out;
    }

    private async connect(url: string) {
        let ths = this;
        return new Promise<void>((acc) => {
            ths.socket = new WebSocket(url);
            ths.socket.onopen = () => {
                ths.emitLifecycleEvent('connect', {})
                acc();
            }
            ths.socket.onerror = (evt) => {
                console.log(evt);
                debugger;
            }
            ths.socket.onclose = (evt) => {
                ths.emitLifecycleEvent('disconnect', { code: evt.code, reason: evt.reason })
                console.log(`Reconnecting to ${url} in ${ClientWebSucket.reconnectDelay}`)
                setTimeout(() => (ths.connect(url)), ClientWebSucket.reconnectDelay)
            }
            ths.socket.onmessage = (evt) => {
                let objMsg = JSON.parse(evt.data as string);
                ths.handleSuckMsg(objMsg)
            }
        })
    }
    protected _sendSuckMsg(msg: SuckMSG<Protocol>): void {
        this.socket.send(JSON.stringify(msg))
    }


}