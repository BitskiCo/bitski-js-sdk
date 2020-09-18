import { AccessTokenProvider, AuthenticatedFetchSubprovider, BitskiEngine, Network } from 'bitski-provider';
import { AuthProvider } from '../auth/auth-provider';
import { ProviderOptions } from '../bitski';
import { BITSKI_RPC_BASE_URL, BITSKI_TRANSACTION_API_BASE_URL, BITSKI_WEB_BASE_URL } from '../constants';
import { BitskiTransactionSigner } from '../signing/transaction-signer';
import { AuthenticatedCacheSubprovider } from '../subproviders/authenticated-cache';
import { RemoteAccountSubprovider } from '../subproviders/remote-accounts';
import { RestFetchSubprovider } from '../subproviders/rest-fetch';
import { SignatureSubprovider } from '../subproviders/signature';

// Predicate to determine if the token provider is an AuthProvider
function isAuthProvider(object: any): object is AuthProvider {
  return (object as AuthProvider).getUser !== undefined;
}

export class BitskiBrowserEngine extends BitskiEngine {

  private network: Network;
  private webBaseUrl: string;
  private apiBaseUrl: string;
  private tokenProvider: AccessTokenProvider;
  private clientId: string;
  private sdkVersion: string;

  // Headers for bitski endpoints
  private headers: object;

  // Headers specifically for rpc endpoint
  private rpcHeaders: object;

  private signer: BitskiTransactionSigner;

  constructor(
    clientId: string,
    tokenProvider: AccessTokenProvider,
    sdkVersion: string,
    network: Network,
    options: ProviderOptions = {},
  ) {
    super(options);
    options = options || {};
    this.network = network;
    this.clientId = clientId;
    this.sdkVersion = sdkVersion;
    this.apiBaseUrl = options.apiBaseUrl || BITSKI_TRANSACTION_API_BASE_URL;
    this.webBaseUrl = options.webBaseUrl || BITSKI_WEB_BASE_URL;
    this.tokenProvider = tokenProvider;

    const defaultBitskiHeaders = {
      'X-API-KEY': this.clientId,
      'X-CLIENT-ID': this.clientId,
      'X-CLIENT-VERSION': this.sdkVersion,
    };

    this.headers = defaultBitskiHeaders;
    this.rpcHeaders = {};

    if (options && options.additionalHeaders) {
      this.headers = Object.assign({}, options.additionalHeaders, this.headers);
      this.rpcHeaders = options.additionalHeaders;
    }

    if (this.network && this.network.rpcUrl.includes('bitski.com')) {
      this.rpcHeaders = Object.assign({}, this.rpcHeaders, defaultBitskiHeaders);
    }

    this.signer = new BitskiTransactionSigner(this.webBaseUrl, this.apiBaseUrl, this.headers, options.callbackURL);

    this.addSubproviders();
  }

  protected addSubproviders() {
    // Used for eth_accounts calls
    const accountsProvider = new RemoteAccountSubprovider(
      `${BITSKI_RPC_BASE_URL}/mainnet`,
      false,
      this.tokenProvider,
      this.headers,
    );

    // Used for all other calls
    const fetchSubprovider = new AuthenticatedFetchSubprovider(
      this.network.rpcUrl,
      false,
      this.tokenProvider,
      this.rpcHeaders,
    );

    // Respond to some requests via userinfo object if available
    if (isAuthProvider(this.tokenProvider)) {
      const cacheSubprovider = new AuthenticatedCacheSubprovider(this.tokenProvider, this);
      this.addProvider(cacheSubprovider);
    }

    // Ensure that whenever accounts are requested, they go through Bitski
    this.addProvider(accountsProvider);

    // Respond to requests that need signed with an iframe
    const signatureSubprovider = new SignatureSubprovider(this.network, this.signer, this.tokenProvider);
    this.addProvider(signatureSubprovider);

    // Respond to block request via REST is using Bitski RPC endpoint
    if (this.network.rpcUrl.startsWith('https://api.bitski.com')) {
      const blockProvider = new RestFetchSubprovider({rpcUrl: this.network.rpcUrl, defaultHeaders: this.headers});
      this.addProvider(blockProvider);
    }

    // Finally, add our basic HTTP provider
    this.addProvider(fetchSubprovider);
  }

}
