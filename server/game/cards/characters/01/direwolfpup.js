const DrawCard = require('../../../drawcard.js');

class DirewolfPup extends DrawCard {
    constructor(owner, cardData) {
        super(owner, cardData);

        this.registerEvents(['onCardPlayed', 'onCardLeftPlay']);
    }

    calculateStrength() {
        this.strengthModifier = this.owner.cardsInPlay.reduce((counter, card) => {
            if(card.uuid === this.uuid || !card.hasTrait('Direwolf')) {
                return counter;
            }

            return counter + 1;
        }, 0);
    }

    play(player) {
        super.play(player);

        this.calculateStrength();
    }

    onCardPlayed(player, cardId) {
        if(!this.inPlay || this.owner !== player) {
            return;
        }

        var card = player.findCardInPlayByUuid(cardId);
        if(!card) {
            return;
        }

        this.calculateStrength();
    }

    onCardLeftPlay(player) {
        if(this.owner !== player) {
            return;
        }
    
        this.calculateStrength();
    }
}

DirewolfPup.code = '01149';

module.exports = DirewolfPup;