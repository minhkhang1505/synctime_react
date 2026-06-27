# Database Schema & Security

## 1. Purpose
Define the data structures, relationships, security policies (RLS), and optimization strategies for PostgreSQL on Supabase.

## 2. Entity Relationship Diagram (ERD)
```mermaid
erDiagram
    PROFILES ||--o{ GROUP_MEMBERS : "has"
    PROFILES ||--o{ AVAILABILITY_SLOTS : "has"
    PROFILES ||--o{ EXPENSES : "creates"
    PROFILES ||--o{ PAYMENT_LOGS : "makes"
    PROFILES ||--o{ NOTIFICATIONS : "receives"
    PROFILES ||--o{ ACTIVITY_LOGS : "logs activity"
    
    GROUPS ||--o{ GROUP_MEMBERS : "has"
    GROUPS ||--o{ EXPENSES : "contains"
    GROUPS ||--o{ NOTIFICATIONS : "associates"
    GROUPS ||--o{ ACTIVITY_LOGS : "contains"
    
    EXPENSES ||--o{ PAYMENT_LOGS : "has"

    GROUPS {
        uuid id PK
        string name
        string invite_code "UNIQUE"
        uuid created_by FK "matches profiles.id"
        timestamp created_at
        timestamp updated_at
    }
    PROFILES {
        uuid id PK "matches auth.users.id"
        string email
        string full_name
        string avatar_url
    }
    GROUP_MEMBERS {
        uuid group_id PK, FK "matches groups.id"
        uuid user_id PK, FK "matches profiles.id"
        string role "owner, admin, member"
        timestamp joined_at
    }
    AVAILABILITY_SLOTS {
        uuid id PK
        uuid user_id FK
        uuid group_id FK
        date available_date
        time start_time
        time end_time
        timestamp updated_at
        CONSTRAINT fk_availability_slots_group_member "FOREIGN KEY (group_id, user_id) REFERENCES group_members(group_id, user_id)"
        CONSTRAINT unique_user_availability_slot "UNIQUE(group_id, user_id, available_date, start_time, end_time)"
    }
    EXPENSES {
        uuid id PK
        uuid group_id FK "matches groups.id"
        string title
        numeric amount "amount >= 0"
        uuid created_by FK "matches profiles.id"
        timestamp created_at
        timestamp updated_at
    }
    PAYMENT_LOGS {
        uuid id PK
        uuid expense_id FK "matches expenses.id"
        uuid user_id FK "matches profiles.id"
        timestamp paid_at
        text note
        timestamp created_at
        CONSTRAINT unique_user_expense_payment "UNIQUE(expense_id, user_id)"
    }
    NOTIFICATIONS {
        uuid id PK
        uuid user_id FK "matches profiles.id (recipient)"
        uuid group_id FK "matches groups.id"
        uuid actor_id FK "matches profiles.id (actor)"
        string type "USER_JOINED, USER_LEFT, AVAILABLE_UPDATED, PAYMENT_MARKED"
        jsonb payload
        boolean is_read
        timestamp created_at
    }
    ACTIVITY_LOGS {
        uuid id PK
        uuid group_id FK "matches groups.id"
        uuid actor_id FK "matches profiles.id"
        string action "CREATE_GROUP, USER_JOINED, USER_LEFT, UPDATE_AVAILABILITY, CREATE_EXPENSE, PAYMENT_MARKED"
        string entity
        uuid entity_id
        timestamp created_at
    }
```

## 3. Table Explanations
- **`profiles`**: Stores user information. Automatically populated via database trigger when a new user signs up in `auth.users`.
- **`groups`**: Stores group details, the creator (`created_by`), and a unique `invite_code` for sharing.
- **`group_members`**: Junction table linking users to groups, including their `role` (owner, admin, member).
- **`availability_slots`**: Stores time ranges when a user is free. Verified by foreign key constraint to ensure they are active group members.
- **`expenses`**: Groups shared expenses (e.g. rent, internet, electricity) with amount and creator details.
- **`payment_logs`**: Records payment confirmations where users manually declare they paid a specific expense.
- **`notifications`**: User-specific notification records generated automatically on group events.
- **`activity_logs`**: Audit logs capturing all major modifications inside groups for history and debugging.

## 4. Row Level Security (RLS) Strategy
- **`profiles`**:
  - `SELECT`: Public or Authenticated users can view basic profile info.
  - `UPDATE`: Users can only update their own profile (`auth.uid() = id`).
- **`groups`**:
  - `SELECT`: Members of the group can view the group details.
  - `INSERT`: Authenticated users can create groups.
- **`group_members`**:
  - `SELECT`: Users can view memberships of groups they belong to.
  - `INSERT`: Users can join if they have the valid `invite_code`.
- **`availability_slots`**:
  - `SELECT`: Users can view availability of members in the same group.
  - `INSERT/UPDATE/DELETE`: Users can only modify their own slots (`auth.uid() = user_id`).
- **`expenses`**:
  - `SELECT`/`INSERT`: Group members can view/insert expenses.
  - `UPDATE`/`DELETE`: Expense creators or group owners/admins can modify.
- **`payment_logs`**:
  - `SELECT`/`INSERT`: Group members can view/insert their own payments.
  - `DELETE`: Payment log creators can remove.
- **`notifications`**:
  - `SELECT`/`UPDATE`/`DELETE`: Users can manage their own notification records (`user_id = auth.uid()`).
- **`activity_logs`**:
  - `SELECT`: Group members can view activity logs for groups they belong to.
  - `INSERT`/`UPDATE`/`DELETE`: Database triggers only.

## 5. Optimization Indexes
- `idx_availability_slots_group_date`: Optimizes query of free times on group & date.
- `idx_notifications_user_created`: Optimizes loading of user's unread notifications feed sorted by date.
- `idx_payment_logs_expense_id`: Optimizes list of payments for an expense.

## 6. Realtime Subscription Strategy
- Enable Supabase Realtime on `availability_slots` (for calendar sync), `payment_logs`/`expenses` (for payment dashboard updates), and `notifications` (for real-time toast alerts).
