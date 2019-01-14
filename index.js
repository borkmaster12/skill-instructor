/*
What does this do?
    - Automatically handles purchasing new skills when you level up.
    - Waits until you're out of combat to purchase skills.
TODO:
    - Better integration with Item Cache
        - Options to temporarily disable Item Cache blocking packets
        - Find how the data comes back from Item Cache to the client and use that
        - Make Item Cache update a global variable for player gold
        - Just drop gold-checking all together (maybe just have a toggle-able option for it)
    - Automatically remove the new skill glyph popup notification when you level up (glyphs level 20)
*/
module.exports = function skillUpdateLogger(mod) {
    let playerGold = 0;
    let skillLearnList = [];
    let hookSLL = null;
    let hookInv = null;
    let hookStatus = null;
    const COMMAND = mod.command;
    const GET_GAMEID = () => { return mod.game.me.gameId };
    const GET_LEVEL = () => { return mod.game.me.level };
    const GET_STATUS = () => { return mod.game.me.status };
    const REQUEST_SKILL_LEARN_LIST = () => { mod.send('C_SKILL_LEARN_LIST', 1, { unk: 0xFFFFFFFF }); };
    const LEARN_NEW_SKILLS = () => {
        TEMP_LISTEN_PLAYER_GOLD();
        global.invCacheOverride = 1;
        mod.send('C_SHOW_INVEN', 1, { unk: 1 });
    };
    const TEMP_LISTEN_PLAYER_GOLD = () => {
        hookInv = mod.hook(`S_INVEN`, 16, (event) => {
            if (event.gameId === GET_GAMEID()) {
                mod.unhook(hookInv);
                hookInv = null;
                playerGold = event.gold;
                TEMP_LISTEN_SLL();
                REQUEST_SKILL_LEARN_LIST();
            }
        });
    };
    const TEMP_LISTEN_SLL = () => {
        hookSLL = mod.hook(`S_SKILL_LEARN_LIST`, 1, (event) => {
            mod.unhook(hookSLL);
            hookSLL = null;
            skillLearnList = event.skillList.filter(skill => skill.level <= GET_LEVEL() && playerGold >= skill.price);
            global.invCacheOverride = 0;
            if (Array.isArray(skillLearnList) && skillLearnList.length) {
                mod.game.me.inCombat ? WAIT_UNTIL_COMBAT_END() : TRY_PURCHASE_SKILLS();
            } else {
                COMMAND.message("No new skills to purchase.");
            }
        });
    };
    const TRY_PURCHASE_SKILLS = () => {
        if (playerGold && skillLearnList) {
            COMMAND.message(`${skillLearnList.length} new skills available. Learning skills...`);
            skillLearnList.forEach(skill => {
                if (playerGold >= skill.price) {
                    mod.send(`C_SKILL_LEARN_REQUEST`, 1, { unk1: 0, skill: skill.skill, type: skill.type });
                    playerGold -= BigInt(skill.price);
                } else {
                    COMMAND.message(`Not enough gold to learn skill ${skill.skill} - Cost: ${skill.price}.`);
                }
            });
        }
    };
    const WAIT_UNTIL_COMBAT_END = () => {
        hookStatus = mod.hook(`S_USER_STATUS`, 2, (event) => {
            if (event.gameId === GET_GAMEID() && event.status === 0) {
                mod.unhook(hookStatus);
                hookStatus = null;
                TRY_PURCHASE_SKILLS();
            }
        });
    };

    mod.hook(`S_USER_LEVELUP`, 2, (event) => {
        if (event.gameId === GET_GAMEID()) {
            COMMAND.message(`Congrats on level ${GET_LEVEL()}! Checking for new skills...`);
            LEARN_NEW_SKILLS();
        }
    });

    COMMAND.add('learn', () => {
        LEARN_NEW_SKILLS();
    });
};