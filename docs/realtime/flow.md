# Realtime Flow

## 1. Purpose
Define how the application synchronizes availability data instantly across clients.

## 2. Realtime Architecture
We utilize Supabase Realtime (WebSockets) to listen for database changes.

## 3. Flow
1. **User A** selects a new free time slot and saves.
2. The frontend sends a standard `POST`/`PUT` REST request to Supabase to insert/update the `availability_slots` table.
3. Supabase Database triggers a Realtime event.
4. **User B** (viewing the same group) has an active WebSocket subscription:
   ```typescript
   supabase
     .channel('group-availability')
     .on('postgres_changes', { 
       event: '*', 
       schema: 'public', 
       table: 'availability_slots',
       filter: `group_id=eq.${currentGroupId}` 
     }, payload => {
       // React Query: Invalidate cache or optimistically update
       queryClient.invalidateQueries(['availability', currentGroupId]);
     })
     .subscribe();
   ```
5. React Query fetches the updated data (or applies the payload directly), and the UI re-renders instantly to show User A's new availability.

## 4. Stability & Simplification
- Instead of managing complex CRDTs or custom WebSocket servers, we rely on PostgreSQL row changes.
- React Query handles caching and deduplication. Realtime events simply trigger cache invalidations to ensure consistency.
