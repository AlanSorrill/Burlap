import express from 'express';
import * as core from 'express-serve-static-core';
import webpackDevMiddleware from 'webpack-dev-middleware'
import webpack, { Configuration, Stats } from "webpack";
import Path from 'path'
import ws from 'ws'
import http from 'http'
import { CombineProtocols, DefaultProtocol, Protocol_GetEventNames, Protocol_GetEventPacketObj, Protocol_GetState, ServerSucketOptions, ServerWebSucket,  SucketProtocol } from './ServerImports';
import { addWebpackListener, clientWebpackConfig } from './ClientWebpackConfig';

export type BurlapOptions<Protocol extends SucketProtocol> = {
    port: number,
    initRouts: (expressApp: core.Express, burlap: Burlap<Protocol>) => Promise<void>
    sucketOptions: ServerSucketOptions<Protocol>
    webpackEntries: Configuration['entry']
}
export class Burlap<Protocol extends SucketProtocol>  {
    socketServer: ws.Server
    app: core.Express
    options: BurlapOptions<Protocol | DefaultProtocol>

    static defaultSucketOptions = {
        reqRespListeners: {

        },
        eventPredicates: {
            webpackBuildUpdate: (reg, packet,state) => (true)
        },
        defaultState() {
            return {} as Protocol_GetState<DefaultProtocol>
        },
    } as ServerSucketOptions<DefaultProtocol>
    // sucketOptions: SucketOptions<Protocol>
    static async Create<Protocol extends SucketProtocol>(options: BurlapOptions<Protocol>): Promise<Burlap<Protocol>> {
        let out = new Burlap(options);
        await out.init();
        return out;
    }
    private constructor(options: BurlapOptions<Protocol>) {
        // this.emitEvent = this.emitEvent.bind(this);
        let opts = options as BurlapOptions<Protocol | DefaultProtocol>
        opts.sucketOptions = CombineProtocols(opts.sucketOptions, Burlap.defaultSucketOptions)
        this.options = opts;
    }
    private async init() {
        let ths: Burlap<Protocol> = this;
        this.app = express()


        await this.options.initRouts(this.app, ths as any);
        // this.sucketOptions = addServerOptions(options.sucketOptions, { defaultEventPredicates: { webpackProgress: (reg, packet) => (true) } });
        this.socketServer = new ws.Server({ noServer: true });
        this.socketServer.on('connection', (socket: ws.WebSocket) => {
            ths.addSocketHandler(socket)
        });
        let server = http.createServer(this.app).listen(this.options.port)
        server.on('upgrade', (request, socket, head) => {
            ths.socketServer.handleUpgrade(request, socket, head, wsSocket => {
                console.log(`Upgrading websocket`)
                ths.socketServer.emit('connection', wsSocket, request);
            });
        });


        let webpackConfig = clientWebpackConfig(ths.options.webpackEntries)
        this.app.use(await this.initWebpack(webpackConfig))
    }



    emitEvent: <EventName extends Protocol_GetEventNames<DefaultProtocol | Protocol>>(eventName: EventName, packet: Protocol_GetEventPacketObj<DefaultProtocol | Protocol, EventName>) => void = function (eventName, packet) {
        
        let ths: Burlap<Protocol> = this
        console.log(`Emitting event ${eventName} to ${ths.suckets.size}`)
        ths.suckets.forEach((sucket) => {
            sucket.emitEvent(eventName, packet);
        })
    }

    private socketCount = 0
    private addSocketHandler(socket: ws.WebSocket) {
        let id = `${this.socketCount++}${Date.now()}`
        let sucket = new ServerWebSucket<Protocol | DefaultProtocol>(id, socket, this.options.sucketOptions, this as any)
        let ths = this;
        sucket.onLifecycle('disconnect',(evt)=>{
            console.log(`${id} sucket disconnected ${evt.code} ${evt.reason}`)
            ths.suckets.delete(id)
        })
        this.suckets.set(id, sucket);
    }
     suckets: Map<string, ServerWebSucket<Protocol | DefaultProtocol>> = new Map();


    compiler: webpack.Compiler
    private async initWebpack(config: Configuration): Promise<webpackDevMiddleware.API<webpackDevMiddleware.IncomingMessage, webpackDevMiddleware.ServerResponse>> {
        let ths = this;
        return new Promise((acc, _rej) => {
            ths.compiler = webpack(config, (err?: Error, stats?: Stats) => {
                if (stats?.hasErrors())
                    console.log(`Webpack Build Error`, err)
            }) as webpack.Compiler;
            ths.compiler.hooks.watchRun.tap('WatchRun', (comp) => {
                if (comp.modifiedFiles) {
                    let changed = Array.from(comp.modifiedFiles)
                    console.log(`-----------Changed Files---------`)
                    console.log(changed.join('\n'))
                    console.log('-----------------------------')
                }
            })


            let webpackMiddle = webpackDevMiddleware(ths.compiler, {
                publicPath: '/wp/'
            });
            let lastUpdateP = 0;
            webpackMiddle.waitUntilValid(() => {
                addWebpackListener((p: number, m: string, _a: any[]) => {
                    if (p > lastUpdateP + 0.01 || lastUpdateP > p) {
                        lastUpdateP = p;
                        console.log(`Webpack Build ${p} ${m}`, _a)
                    }
                    // (ths as any as Burlap<DefaultSucketProtocol>).emitEvent('webpackProgress', { progress: p, info: `${m}${_a.join(', ')}}` })
                    // ths.notifySubscribers('', { progress: p, info: _a, message: m, type: 'WebpackBuildUpdate' } as MSG_WebpackBuildUpdate)
                    (ths as any as Burlap<DefaultProtocol>).emitEvent('webpackBuildUpdate', { progress: p, message: m, extra: _a })
                    // ths.webpackWatchers.forEach((callback) => {
                    //     callback(p, m);
                    // })
                })
                console.log(`Webpack Initialized`);

                acc(webpackMiddle)
            })
        })
    }
}