// Mock the browser window for tests
global.window = {
  ...global.window,
  initialContentData: {
    albums: [],
    photos: [],
    snips: [],
    playlists: []
  }
};