export type MapStyle = 'voyager' | 'satellite' | 'terrain';

export interface LayerState {
  showCorridors: boolean;
  showExits: boolean;
  showPlaces: boolean;
  showRestAreas: boolean;
  showDiscover: boolean;
  categoryFilter: number | null;
}

export interface UserLocation {
  lat: number;
  lon: number;
  accuracy: number;
}

export interface PlaceSelection {
  placeIndex: number;
  exitIndex?: number;
  link?: {
    distanceM: number;
    driveM: number | null;
    driveS: number | null;
  };
}
