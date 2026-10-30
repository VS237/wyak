'use server';

import { createClient } from '@supabase/supabase-js';

export async function createPersonnelAccount(formData: {
  full_name: string;
  email: string;
  password: string;
  phone_number: string;
  role: string;
}) {
  try {
    // Initialize Supabase Admin client with Service Role Key
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      }
    );

    // 1. Create user in Supabase Auth
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: formData.email,
      password: formData.password,
      email_confirm: true, // Automatically verify their email so they can log in immediately
      user_metadata: {
        full_name: formData.full_name,
        role: formData.role,
      },
    });

    if (authError) throw authError;
    if (!authData.user) throw new Error('Failed to create auth user.');

    const userId = authData.user.id;

    // 2. Insert corresponding record into public.profiles using the exact auth user ID
    const { error: profileError } = await supabaseAdmin.from('profiles').insert({
      id: userId,
      full_name: formData.full_name,
      phone_number: formData.phone_number,
      role: formData.role,
      is_active: true,
    });

    if (profileError) {
      // Rollback auth user creation if profile insert fails
      await supabaseAdmin.auth.admin.deleteUser(userId);
      throw profileError;
    }

    return { success: true };
  } catch (error: any) {
    console.error('Server action error:', error?.message || error);
    return { success: false, error: error?.message || 'Unknown error occurred' };
  }
}