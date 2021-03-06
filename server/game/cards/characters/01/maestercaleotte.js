const DrawCard = require('../../../drawcard.js');

class MaesterCaleotte extends DrawCard {
    setupCardAbilities() {
        this.reaction({
            when: {
                afterChallenge: (event, challenge) => challenge.loser === this.controller && challenge.isParticipating(this)
            },
            target: {
                activePromptTitle: 'Select a character',
                cardCondition: card => card.location === 'play area' && card.getType() === 'character'
            },
            handler: context => {
                this.game.promptForIcon(this.controller, this, icon => {
                    this.untilEndOfPhase(ability => ({
                        match: context.target,
                        effect: ability.effects.removeIcon(icon)
                    }));
                    this.game.addMessage('{0} uses {1} to remove {2} {3} icon from {4}',
                        this.controller, this, icon === 'intrigue' ? 'an' : 'a', icon, context.target);
                });
            }
        });
    }
}

MaesterCaleotte.code = '01107';

module.exports = MaesterCaleotte;
