# GOD RULE

YOU MUST FOLLOW TTHE RULES BELOW, NEVER BREAK THEM

1. 所有 db 操作都使用 sqlc，寫在 ./db 裡
2. 所有 db 操作都必須包裝成 repository/ 下定義的 interface， domain 下定義的 struct
3. 除了 repository，其他地方的程式不准碰 db
4. 使用 github.com/samber/do/v2 作 dependencyr injector，具體使用方式參考目前 codebase
5. 前端檔案使用 nextjs + kama，具體使用方式參考目前 codebase

# goal

finish a web based podcast player, user create an account (an uuid), then enter an url to rss. The url is bind to the account. Other device with the same account it will see the same rss url and progress (the progress is bind to the account).
When an account has only one active session, it's the master session. when the second session with the same account id join, it become slave, it can stop, choose episode, seek position, but can not update current playing position. And the slave can take over, it become master, the original master become slave.

# operations

## stop/play

pause the progress and resume
if no current episode appear(for a newly created account), operation play will be ignored

## seek

jump to specific second in the same epidode

## choose

choose another episode to play

## takeover

must be invoked by a slave, the slave become master, the master become slave

## update

must be invoded by the master, update current state (episode, second in the episode)
