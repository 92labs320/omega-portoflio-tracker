export const Config = {
  supabaseUrl:    process.env.EXPO_PUBLIC_SUPABASE_URL  ?? '',
  supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '',
  coinGeckoBase:  'https://api.coingecko.com/api/v3',
  admobAndroidId: process.env.EXPO_PUBLIC_ADMOB_ANDROID_ID ?? '',
  admobIosId:     process.env.EXPO_PUBLIC_ADMOB_IOS_ID    ?? '',
} as const;


