import { User } from 'oidc-client';
import { JsonRPCRequest, JsonRPCResponse, Web3 } from 'web3';
import { BitskiProviderSettings } from './bitski-provider-settings';
import { Dialog } from './dialog';
import { OAuthHttpProvider, OAuthProviderIntegrationType } from './oauth-http-provider';

const BITSKI_API_V1_HOST = 'https://api.bitski.com/v1';
const BITSKI_OAUTH_HOST = 'https://account.bitski.com';
const BITSKI_WEB_HOST = 'https://www.bitski.com';

interface JsonRPC {
    payload: JsonRPCRequest;
    callback: (e: Error, val: JsonRPCResponse) => void;
}

type JsonRPCCallback = (e: Error, val: JsonRPCResponse) => void;

/**
 * A Web3 provider that connects to the Bitski service
 * @example
 * ```javascript
 * var provider = new BitskiProvider('MY_CLIENT_ID');
 * ```
 */
export class BitskiProvider extends OAuthHttpProvider {
    /**
     * Determines how the authorization modals show up for eth_call and eth_sendTransaction.
     */
    public authorizationIntegrationType: OAuthProviderIntegrationType = OAuthProviderIntegrationType.IFRAME;

    /**
     * Queued requests to be sent upon logging in.
     */
    private queuedSends: JsonRPC[] = [];
    private pendingTransactions: JsonRPC[] = [];
    private networkName: string;
    private currentTransactionDialog?: Dialog = null;
    private currentTransactionWindow?: Window = null;

    /**
     * @param clientId OAuth Client ID
     * @param networkName Network name
     * @param redirectUri Redirect URL, defaults to window.location.href
     * @param postLogoutRedirectUri Post logout redirect URL, defaults to window.location.href
     */
    constructor(clientId: string, networkName: string = 'kovan', redirectUri?: string, postLogoutRedirectUri?: string) {
        super(
            `${BITSKI_API_V1_HOST}/web3/${networkName}`,
            0,
            new BitskiProviderSettings(BITSKI_OAUTH_HOST, clientId, redirectUri, postLogoutRedirectUri),
        );
        this.networkName = networkName;
    }

    /**
     * After sign in functionality
     * @param user User authentication object to flush send queue.
     */
    public didSignIn(user: User) {
        super.didSignIn(user);
        this.flushQueuedSends(user);
    }

    /**
     * Returns a boolean value that indicates whether the Web3 method
     * can be executed without being logged in.
     * @param method A web3 method name (ex: 'eth_sign')
     * @returns boolean for if the method can be executed without being logged in.
     */
    public receiveMessage(event: MessageEvent): void {
        super.receiveMessage(event);

        if (event.origin !== BITSKI_WEB_HOST) {
            return;
        }

        const response: JsonRPCResponse = event.data;

        this.pendingTransactions
            .filter((pendingTransaction) => pendingTransaction.payload.id === response.id)
            .forEach((transaction, index) => {
                this.pendingTransactions.splice(index, 1);
                transaction.callback(null, response);

                if (this.currentTransactionDialog) {
                    this.currentTransactionDialog.dismiss();
                    this.currentTransactionDialog = null;
                }
            });
    }

    /**
     * Sends a Web3 request.
     * @param payload JSON-RPC request object to send.
     * @param callback Handler for send request. `function (e: Error, val: JSONRPCResponse) => void`
     */
    public send(payload: JsonRPCRequest, callback: JsonRPCCallback): void {
        if (this.currentUser) {
            this.sendAuthenticated(payload, this.currentUser, callback);
        } else if (this.requiresAuthentication(payload.method)) {
            this.queuedSends.push({ payload, callback });
            this.signIn();
        } else {
            super.send(payload, callback);
        }
    }

    /**
     * Flush all queued requests
     * @param user User authentication object to send the requests through.
     */
    private flushQueuedSends(user: User): void {
        while (this.queuedSends.length > 0) {
            const queuedSend = this.queuedSends.pop();
            this.sendAuthenticated(queuedSend.payload, user, queuedSend.callback);
        }
    }

    /**
     * Determines if web3 method requires authentication
     * @param method a web3 method name (ex: 'eth_sign')
     */
    private requiresAuthentication(method: string): boolean {
        switch (method) {
            case 'eth_coinbase':
            case 'eth_accounts':
            case 'eth_accounts':
            case 'eth_sign':
            case 'eth_sendTransaction':
                return true;
            default:
                return true; // Temp, should eventually be false
        }
    }

    /**
     * Returns a boolean value that indicates whether the Web3 method
     * can be executed without the user's explicit authorization.
     * @param method a web3 method name (ex: 'eth_sign')
     */
    private requiresAuthorization(method: string): boolean {
        switch (method) {
            case 'eth_sign':
            case 'eth_sendTransaction':
                return true;
            default:
                return false;
        }
    }

    /**
     * Sends a request with authentication headers.
     * @param payload JSON-RPC request object to send.
     * @param user User authentication object to send the requests through.
     * @param callback Handler for send request. `function (e: Error, val: JSONRPCResponse) => void`
     */
    private sendAuthenticated(payload: JsonRPCRequest, user: User, callback: JsonRPCCallback): void {
        if (this.requiresAuthorization(payload.method)) {
            this.showAuthorization(payload, user, callback);
        } else {
            super.send(payload, callback);
        }
    }

    /**
     * Presents an authorization request to the user.
     * @param payload JSON-RPC request object to send.
     * @param callback Handler for send request. `function (e: Error, val: JSONRPCResponse) => void`
     */
    private showAuthorization(payload: JsonRPCRequest, user: User, callback: JsonRPCCallback): void {
        if (this.currentTransactionDialog) {
            this.currentTransactionDialog.dismiss();
        }

        if (this.currentTransactionWindow) {
            this.currentTransactionWindow.close();
        }

        const ethSendTransactionUrl = `${BITSKI_WEB_HOST}/eth-send-transaction`;
        const encodedPayload = btoa(JSON.stringify(payload));
        const txnParams = `network=${this.networkName}&payload=${encodedPayload}&accessToken=${user.access_token}`;

        switch (this.authorizationIntegrationType) {
            case OAuthProviderIntegrationType.IFRAME:
                this.pendingTransactions.push({ payload, callback });

                const iframe = document.createElement('iframe');
                iframe.width = '400px';
                iframe.height = '380px';
                iframe.frameBorder = '0';
                iframe.src = `${ethSendTransactionUrl}?${txnParams}`;

                this.currentTransactionDialog = new Dialog(iframe);
                break;
            case OAuthProviderIntegrationType.REDIRECT:
                window.location.href = `${ethSendTransactionUrl}?${txnParams}`;
                break;
            case OAuthProviderIntegrationType.POPUP:
                const options = 'width=400,height=380,toolbar=0,menubar=0,location=0';
                const newWindow = window.open(`${ethSendTransactionUrl}?${txnParams}`, 'Bitski Authorization', options);
                if (window.focus) { newWindow.focus(); }

                this.currentTransactionWindow = newWindow;
                break;
            case OAuthProviderIntegrationType.SILENT:
                throw new Error('Silent authorization requests are not allowed');
        }
    }

    /**
     * Check whether we are connected to the server.
     * @returns boolean if we are connected.
     */
    private isConnected(): boolean {
        return true;
    }
}
