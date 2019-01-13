/*
What does this do?
    - Automatically handles purchasing new skills when you level up.
    - Waits until you're out of combat to purchase skills.
TODO:
    - Better integration with Item Cache
        - Options to temporarily disable Item Cache blocking packets
        - Find how the data comes back from Item Cache to the client and use that
        - Make Item Cache update a global variable for player gold
        - See if there are any options in the Item Cache config
        - Just drop gold-checking all together (maybe just have a toggle-able option for it)
    - Automatically remove the new skill glyph popup notification when you level up (glyphs level 20)
    - Look further into the 'Me' class at \mods\tera-game-state\lib (mod.game.Me.inCombat/gameId)
*/
module.exports = function skillUpdateLogger(mod) {
    let playerId = 0;
    let playerLevel = 0;
    let playerGold = 0;
    let purchaseList = [];
    let hookSLL = null;
    let hookInv = null;
    let hookStatus = null;
    const COMMAND = mod.command;
    const SEND_C_SKILL_LEARN_LIST = () => { mod.send('C_SKILL_LEARN_LIST', 1, { unk: 0xFFFFFFFF }); };
    const DEBUG_LOG = (logMessage) => { console.log( GET_DATE_STAMP() + logMessage ) };
    const GET_DATE_STAMP = () => {
        let d = new Date();
        return "[" + d.getHours() + ":" + d.getMinutes() + ":" + d.getSeconds() + ":" + d.getMilliseconds() + "] ";
    };
    const LEARN_NEW_SKILLS = () => {
        HOOK_NEXT_INV();
        global.invCacheOverride = 1;
        mod.send('C_SHOW_INVEN', 1, { unk: 1 });
    };
    const HOOK_NEXT_INV = () => {
        hookInv = mod.hook(`S_INVEN`, 16, (event) => {
            if (event.gameId === playerId) {
                playerGold = event.gold;
                COMMAND.message("Player Gold: " + playerGold);
                mod.unhook(hookInv);
                hookInv = null;
                HOOK_NEXT_SLL();
                SEND_C_SKILL_LEARN_LIST();
            }
        });
    }
    const HOOK_NEXT_SLL = () => {
        hookSLL = mod.hook(`S_SKILL_LEARN_LIST`, 1, (event) => {
            purchaseList = event.skillList.filter(skill => skill.level <= playerLevel && playerGold >= skill.price);
            global.invCacheOverride = 0;
            mod.unhook(hookSLL);
            hookSLL = null;
            console.log(purchaseList);
            if (purchaseList) { mod.game.me.inCombat ? WAIT_UNTIL_COMBAT_END() : TRY_PURCHASE_SKILLS(); }
        });
    };
    const TRY_PURCHASE_SKILLS = () => {
        if (playerGold && purchaseList) {
            purchaseList.forEach(skill => {
                if (playerGold >= skill.price) {
                    mod.send(`C_SKILL_LEARN_REQUEST`, 1, { unk1: 0, skill: skill.skill, type: skill.type });
                    COMMAND.message(`Purchasing skill: ${skill.skill} for price: ${skill.price}`);
                    playerGold -= BigInt(skill.price);
                } else {
                    COMMAND.message(`Not enough gold to purchase skill ${skill.skill} - Cost: ${skill.price}`);
                }
            });
            playerGold = 0;
            purchaseList = [];
        }
    };
    const WAIT_UNTIL_COMBAT_END = () => {
        hookStatus = mod.hook(`S_USER_STATUS`, 2, (event) => {
            if (event.status === 0) {
                mod.unhook(hookStatus);
                hookStatus = null;
                TRY_PURCHASE_SKILLS();
            }
        })
    };

    mod.hook(`S_LOGIN`, 12, (event) => {
        playerId = event.gameId;
        playerLevel = event.level;
    });

    mod.hook(`S_USER_LEVELUP`, 2, (event) => {
        if (event.gameId === playerId) {
            playerLevel = event.level;
            LEARN_NEW_SKILLS();
        }
    });

    COMMAND.add('testFlow', () => {
        HOOK_NEXT_INV();
        mod.send('C_SHOW_INVEN', 1, { unk: 1 });
    })

    COMMAND.add('testCombat', () => {
        COMMAND.message('In Combat? ' + mod.game.me.inCombat);
    })
};