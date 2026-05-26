-- name: CreateAccount :one
INSERT INTO accounts (id) VALUES (?) RETURNING *;

-- name: GetAccount :one
SELECT * FROM accounts WHERE id = ?;

-- name: UpdateAccount :one
UPDATE accounts
SET rss_url = ?,
    order_dir = ?,
    current_episode_id = ?,
    position_sec = ?
WHERE id = ?
RETURNING *;

-- name: UpdatePosition :exec
UPDATE accounts SET current_episode_id = ?, position_sec = ? WHERE id = ?;

-- name: UpdateRSS :exec
UPDATE accounts SET rss_url = ? WHERE id = ?;

-- name: DeleteAccount :exec
DELETE FROM accounts WHERE id = ?;
