import { OAuthManager } from '../src/auth/oauth-manager';
import { NoHashQueryStringUtils } from '../src/utils/no-hash-query-string-utils';

function createInstance() {
  return new OAuthManager({ clientId: 'test-client-id', redirectUri: 'http://localhost:3000' });
}

beforeEach(() => {
  // @ts-ignore
  fetch.resetMocks();
});

test('sign in redirect performs redirect', (done) => {
  expect.assertions(2);
  const manager = createInstance();

  const originalLocation = window.location.href;

  // Setup a mock of window.location.assign to complete test
  jest.spyOn(window.location, 'assign').mockImplementation((location) => {
    // Assert location has changed (redirected)
    expect(location).not.toBe(originalLocation);

    // Parse the new location value
    const parser = new NoHashQueryStringUtils();
    const parsed = parser.parseQueryString(location);

    // Delete window location and assign a mock with the expected end state
    delete window.location;
    // @ts-ignore
    window.location = { search: `?code=foo&state=${parsed.state}` };

    // Mock API request for token
    // @ts-ignore
    fetch.mockResponseOnce(JSON.stringify({ access_token: 'test-token' }));

    // Call the callback (which will look at window.location.search)
    manager.redirectCallback().then((tokenResponse) => {
      // Assert the API request was parsed
      expect(tokenResponse.accessToken).toBe('test-token');
      done();
    });
  });

  // Perform sign in request
  manager.signInRedirect();
});

test('sign in popup opens popup', () => {
  expect.assertions(2);

  const manager = createInstance();

  // Spy on window open
  jest.spyOn(window, 'open').mockImplementation((url, target, features) => {
    // Assert the URL is something we expect
    expect(url).toMatch(manager.configuration.authorizationEndpoint);
    // Hack to create an object that is similar to Location in JSDom
    const location = document.createElement('a');
    location.href = `http://localhost:3000/callback?code=foo&state=${manager.authHandler.pendingRequest.state}`;
    // Call the callback to trigger the completion handler
    // @ts-ignore
    manager.authHandler.callback.call(manager.authHandler, location);
  });

  // @ts-ignore
  fetch.mockResponseOnce(JSON.stringify({ access_token: 'test-token' }));

  return manager.signInPopup().then((tokenResponse) => {
    expect(tokenResponse.accessToken).toBe('test-token');
  });
});

test('can handle oauth error response', () => {
  expect.assertions(2);

  const manager = createInstance();

  // Spy on window open
  jest.spyOn(window, 'open').mockImplementation((url, target, features) => {
    // Assert the URL is something we expect
    expect(url).toMatch(manager.configuration.authorizationEndpoint);
    // Hack to create an object that is similar to Location in JSDom
    const location = document.createElement('a');
    location.href =
      `http://localhost:3000/callback?error=womp%20womp&error_description=better%20luck%20next%20time&state=${manager.authHandler.pendingRequest.state}`;
    // Call the callback to trigger the completion handler
    // @ts-ignore
    manager.authHandler.callback.call(manager.authHandler, location);
  });

  return manager.signInPopup().catch((error) => {
    expect(error.message).toBe('womp womp');
  });
});

test('it submits refresh token requests', () => {
  expect.assertions(1);
  const manager = createInstance();

  // @ts-ignore
  fetch.mockResponseOnce(JSON.stringify({ access_token: 'refreshed-token' }));

  return manager.refreshAccessToken('old-token').then((tokenResponse) => {
    expect(tokenResponse.accessToken).toBe('refreshed-token');
  });
});

test('it submits sign out requests', () => {
  expect.assertions(1);
  const manager = createInstance();

  // @ts-ignore
  fetch.mockResponseOnce(JSON.stringify({}));

  return manager.requestSignOut('old-token').then((response) => {
    expect(response).toBeDefined();
  });
});


test('it submits user info requests', () => {
  expect.assertions(1);
  const manager = createInstance();

  // @ts-ignore
  fetch.mockResponseOnce(JSON.stringify({ sub: 'test-user' }));

  return manager.requestUserInfo('test-token').then((userInfo) => {
    expect(userInfo.sub).toBe('test-user');
  });
});

test('it parses error messages returned by api', () => {
  expect.assertions(1);
  const manager = createInstance();
  const errorResponse = {
    error: {
      message: 'Oops!',
    },
  };
  // @ts-ignore
  fetch.mockResponseOnce(JSON.stringify(errorResponse), { status: 500 });

  return manager.requestUserInfo('test-token').catch((error) => {
    expect(error.message).toBe(errorResponse.error.message);
  });
});

test('it parses poorly formed error messages returned by api', () => {
  expect.assertions(1);
  const manager = createInstance();
  const errorResponse = {
    error: 'Oops!',
  };
  // @ts-ignore
  fetch.mockResponseOnce(JSON.stringify(errorResponse), { status: 500 });

  return manager.requestUserInfo('test-token').catch((error) => {
    expect(error.message).toBe(errorResponse.error);
  });
});