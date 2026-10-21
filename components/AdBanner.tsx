import React from 'react';
import Constants from 'expo-constants';

const IS_EXPO_GO = Constants.appOwnership === 'expo';

let BannerAd: any = null;
let BannerAdSize: any = null;

if (!IS_EXPO_GO) {
  const ads = require('react-native-google-mobile-ads');
  BannerAd = ads.BannerAd;
  BannerAdSize = ads.BannerAdSize;
}

const AD_UNIT_ID = 'ca-app-pub-3940256099942544/2934735716';

export function AdBanner() {
  if (IS_EXPO_GO || !BannerAd) return null;

  return (
    <BannerAd
      unitId={AD_UNIT_ID}
      size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER}
      onAdFailedToLoad={(error: any) => console.log('Ad failed to load:', error)}
      onAdLoaded={() => console.log('Ad loaded')}
    />
  );
}
