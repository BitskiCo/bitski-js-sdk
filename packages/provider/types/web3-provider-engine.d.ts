// Type definitions for web3-provider-engine 14.0
// Project: https://github.com/MetaMask/provider-engine#readme
// Definitions by: Leonid Logvinov <https://github.com/LogvinovLeon>
// Definitions: https://github.com/DefinitelyTyped/DefinitelyTyped
// TypeScript Version: 2.4

declare module "web3-provider-engine" {
    import {
        Provider,
        JSONRPCRequestPayload,
        JSONRPCResponsePayload
    } from "ethereum-protocol";

    import { EventEmitter } from 'events';

    interface Web3ProviderEngineOptions {
        pollingInterval?: number;
        blockTracker?: any;
        blockTrackerProvider?: any;
    }

    class Web3ProviderEngine extends EventEmitter implements Provider  {
        constructor(options?: Web3ProviderEngineOptions);
        send(payload: JSONRPCRequestPayload): void;
        sendAsync(
            payload: JSONRPCRequestPayload,
            callback: (
                error: null | Error,
                response: JSONRPCResponsePayload
            ) => void
        ): void;
        addProvider(provider: any): void;
        // start block polling
        start(callback?: () => void): void;
        // stop block polling
        stop(): void;
    }

    export = Web3ProviderEngine;
}

declare module "web3-provider-engine/subproviders/subprovider" {
    import { JSONRPCRequestPayload, JSONRPCResponsePayload } from "ethereum-protocol";
    import Web3ProviderEngine from "web3-provider-engine";

    class Subprovider {
        engine?: Web3ProviderEngine;
        setEngine(engine: Web3ProviderEngine);
        handleRequest(payload: JSONRPCRequestPayload, next: () => void, end: () => void);
        emitPayload(payload: JSONRPCRequestPayload, callback: (error: null | Error, response: JSONRPCResponsePayload) => void);
    }

    export = Subprovider;
}

// declare module "web3-provider-engine/subproviders/nonce-tracker";
// declare module "web3-provider-engine/subproviders/hooked-wallet";
// declare module "web3-provider-engine/subproviders/filters";
