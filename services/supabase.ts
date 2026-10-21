import { createClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';

const ExpoSecureStoreAdapter = {
  getItem: (key: string) => SecureStore.getItemAsync(key),
  setItem: (key: string, value: string) => SecureStore.setItemAsync(key, value),
  removeItem: (key: string) => SecureStore.deleteItemAsync(key),
};

export const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL!,
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!,
  {
    auth: {
      storage: ExpoSecureStoreAdapter,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  }
);

export interface Transaction {
  id: string;
  created_at: string;
  asset: string;
  type: 'buy' | 'sell' | 'stake' | 'unstake' | 'reward' | 'airdrop';
  amount: number;
  price: number;
  exchange: string;
  notes?: string;
  user_id: string;
  category: 'crypto' | 'stock';
}

export async function createTransaction(
  transaction: Omit<Transaction, 'id' | 'created_at' | 'user_id'>
): Promise<Transaction | null> {
  const user = (await supabase.auth.getUser()).data.user;
  if (!user) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('transactions')
    .insert([{ ...transaction, user_id: user.id }])
    .select()
    .single();

  if (error) {
    console.error('Error creating transaction:', error);
    throw error;
  }
  return data;
}

export async function getTransactions(): Promise<Transaction[]> {
  const { data, error } = await supabase
    .from('transactions')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching transactions:', error);
    throw error;
  }
  return data || [];
}

export async function getTransactionsByCategory(
  category: 'crypto' | 'stock'
): Promise<Transaction[]> {
  const { data, error } = await supabase
    .from('transactions')
    .select('*')
    .eq('category', category)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching transactions:', error);
    throw error;
  }
  return data || [];
}

export async function updateTransaction(
  id: string,
  updates: Partial<Omit<Transaction, 'id' | 'user_id'>>
): Promise<Transaction | null> {
  const { data, error } = await supabase
    .from('transactions')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('Error updating transaction:', error);
    throw error;
  }
  return data;
}

export async function deleteTransaction(id: string): Promise<void> {
  const { error } = await supabase.from('transactions').delete().eq('id', id);

  if (error) {
    console.error('Error deleting transaction:', error);
    throw error;
  }
}


