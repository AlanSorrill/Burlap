import webpack, { Configuration, ProvidePlugin, SourceMapDevToolPlugin } from 'webpack';
// import MonacoWebpackPlugin from 'monaco-editor-webpack-plugin'
import path from 'path';
import NodePolyfillPlugin from 'node-polyfill-webpack-plugin';
// import NodePolyfillPlugin from 'node-polyfill-webpack-plugin';

// const MONACO_DIR = path.resolve(__dirname, '../../../node_modules/monaco-editor');
// console.log(`WEBPACK CONFIG IN ${__dirname}`)
// console.log(MONACO_DIR)
let webpackBuildListeners: ((p: number, m: string, a: any[]) => void)[] = []
function addWebpackListener(callback: (p: number, m: string, a: any[]) => void) {
    webpackBuildListeners.push(callback);
}
let burlapRoot = path.resolve(__dirname,'../../../');
let outputDir = path.join(burlapRoot, 'public')
let cacheDirectory = path.join(burlapRoot, 'packCache')
console.log(`Webpack cache directory: ${cacheDirectory}`)

let clientWebpackConfig: (entry: Configuration['entry']) => Configuration = (entry)=>{
    return {
        devtool: 'inline-source-map',
        entry: entry,
    
    
        watch: true,
    
        cache: {
            type: 'filesystem',
            cacheDirectory: cacheDirectory
        },
        target: 'web',
        module: {
            rules: [
                 {
                test: /\.tsx?$/,
                use: [{
                    loader: 'ts-loader',
                    options: {
                        configFile: "tsconfig.client.json",
    
                    }
                }],
                exclude: /node_modules/,
            },
            {
                test: /\.js$/,
                enforce: "pre",
                use: ["source-map-loader"],
                exclude: /node_modules/
            },
            {
                test: /\.ttf$/,
                type: 'asset/resource'
              }
            // {
            //     test: /\.ttf$/,
            //     use: [{
            //         loader: 'ttf-loader',
            //         options: {
            //             name: '[name].[ext]',
            //         },
            //     }]
            // }
                // {
                //     test: /\.ttf$/,
                //     loader: require.resolve('file-loader'),
                //     options: {
                //         context: process.cwd()
                //     }
                // }
                // {
                //     test: /\.ttf$/,
                //     type: 'asset/resource',
                //     options: {
                //         name(file){
                //             return `[hash].[ext]`
                //         }
                //     }
                // }
            ],
    
        },
        // externals: [
    
        // ],
    
        mode: 'development',
        resolve: {
            extensions: ['.tsx', '.ts', '.js', '.css'],
            // fallback: {
            //     'crypto': require.resolve('crypto-browserify'),
            //     "https": require.resolve("https-browserify"),
            //     "stream": require.resolve('stream-browserify'),
            //     'buffer': require.resolve('buffer')
            // }
    
        },
        plugins: [
            new SourceMapDevToolPlugin({
                filename: '[file].map',
                publicPath: '/wp/',
                sourceRoot: path.join(burlapRoot, 'src')
            }),
            new ProvidePlugin({
                Buffer: ['buffer', 'Buffer']
            }),
            new NodePolyfillPlugin({ includeAliases: ['path'] }),
            // new MonacoWebpackPlugin({ languages: ['typescript', 'javascript', 'json'], }),
            new webpack.ProgressPlugin({
                //   /**
                //  * Show active modules count and one active module in progress message
                //  * Default: true
                //  */
                // activeModules?: boolean;
                // /**
                //  * Show entries count in progress message
                //  * Default: false
                //  */
                // entries?: boolean;
                // /**
                //  * Function that executes for every progress step
                //  */
                // handler?: Handler;
                // /**
                //  * Show modules count in progress message
                //  * Default: true
                //  */
                // modules?: boolean;
                // /**
                //  * Minimum modules count to start with, only for mode = modules
                //  * Default: 500
                //  */
                // modulesCount?: number;
                // /**
                //  * Collect profile data for progress steps
                //  * Default: false
                //  */
                // profile?: boolean | null;
                //   percentBy: 'dependencies',
                handler: (percentage: number, msg: string, ...args) => {
                    webpackBuildListeners.forEach((value: (p: number, m: string, a: any[]) => void) => {
                        value(percentage, msg, args);
                    })
    
                }
            })
        ],
        output: {
            path: outputDir,
            filename: '[name].js',
    
            chunkFilename: '[id].[chunkhash].js'
        },
    
    
    }
};
export function portaDopperWebpackConfig(progressListener: (percentage: number, msg: string, args: string[]) => void): Configuration {
    return {
        devtool: 'eval-cheap-module-source-map',

        entry: {
            lib: {
                import: ['react', 'react-dom']
            },
            clientBundle: {
                import: './src/PortaDopper/PortaDopperClientIndex.tsx',
                dependOn: 'lib'
            },
        },


        watch: true,

        cache: {
            type: 'filesystem',
            cacheDirectory: path.resolve(__dirname, '../../../portaDopperPackCache')
        },
        target: 'web',
        module: {
            rules: [{
                test: /\.tsx?$/,
                use: [{
                    loader: 'ts-loader',
                    options: {
                        configFile: "tsconfig.dopperclient.json",

                    }
                }],
                exclude: /node_modules/,
            },
            {
                test: /\.js$/,
                enforce: "pre",
                use: ["source-map-loader"],
                exclude: /node_modules/
            }, {
                test: /\.ttf$/,
                use: ['file-loader'],
            }],

        },
        // externals: [

        // ],

        mode: 'development',
        resolve: {
            extensions: ['.tsx', '.ts', '.js', '.css'],
            fallback: {
                'crypto': require.resolve('crypto-browserify'),
                "https": require.resolve("https-browserify"),
                "stream": require.resolve('stream-browserify'),
                'buffer': require.resolve('buffer/')
            }

        },
        plugins: [
            new SourceMapDevToolPlugin({
                filename: '[file].map',
                publicPath: '/wp/'

            }),
            new ProvidePlugin({
                Buffer: ['buffer', 'Buffer']
            }),
            new NodePolyfillPlugin({ includeAliases: ['path'] }),
            // new MonacoWebpackPlugin({ languages: ['typescript', 'javascript', 'json'] }),
            new webpack.ProgressPlugin({
                //   /**
                //  * Show active modules count and one active module in progress message
                //  * Default: true
                //  */
                // activeModules?: boolean;
                // /**
                //  * Show entries count in progress message
                //  * Default: false
                //  */
                // entries?: boolean;
                // /**
                //  * Function that executes for every progress step
                //  */
                // handler?: Handler;
                // /**
                //  * Show modules count in progress message
                //  * Default: true
                //  */
                // modules?: boolean;
                // /**
                //  * Minimum modules count to start with, only for mode = modules
                //  * Default: 500
                //  */
                // modulesCount?: number;
                // /**
                //  * Collect profile data for progress steps
                //  * Default: false
                //  */
                // profile?: boolean | null;
                //   percentBy: 'dependencies',
                handler: (percentage: number, msg: string, ...args: string[]) => {
                    progressListener(percentage, msg, args);

                }
            })
        ],
        output: {
            path: path.join(__dirname, '/../DopperPublic'),
            filename: '[name].js',

            chunkFilename: '[id].[chunkhash].js'
        },


    }
};
export { clientWebpackConfig, addWebpackListener }