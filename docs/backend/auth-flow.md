# Authentication Flow

## 1. Purpose
Describe the Google OAuth process and user profile management in Supabase.

## 2. Authentication Flow
1. User clicks "Login with Google".
2. Supabase handles the OAuth flow via Google Provider.
3. Upon success, Supabase creates a record in `auth.users`.
4. A Postgres Trigger intercepts the insert on `auth.users` and automatically creates a corresponding record in `public.profiles`.
5. Frontend receives the session token and stores it.

## 3. PostgreSQL Trigger Example
```sql
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, avatar_url)
  VALUES (
    new.id,
    new.email,
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'avatar_url'
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();
```
