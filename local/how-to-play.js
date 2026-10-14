function neonbrawlShowHowto(){
      if (!window.PixoHowto) return;
      window.PixoHowto.open({
        title: 'HOW TO PLAY NEONBRAWL',
        sections: [
          { heading: 'OBJECTIVE', body: 'Survive waves of enemies in a neon arena. Earn gold, level up skills, and take down the boss every 5 waves.' },
          { heading: 'KEYBOARD', items: [
            { keys: ['W','A','S','D'], desc: 'Move' },
            { keys: ['Mouse'],         desc: 'Aim' },
            { keys: ['Click'],         desc: 'Shoot' },
            { keys: ['Space'],         desc: 'Dash (short invincibility)' },
            { keys: ['F'],             desc: 'Melee attack' },
            { keys: ['R'],             desc: 'Reload' },
            { keys: ['E'],             desc: 'Interact (totems / shop)' },
          ]},
          { heading: 'MOBILE', items: [
            { keys: ['L-Stick'],       desc: 'Move' },
            { keys: ['R-Stick'],       desc: 'Aim and auto-fire' },
            { keys: ['D'],             desc: 'Dash button' },
          ]},
          { heading: 'TIPS', body: 'Use dash to phase through bullets and reposition. Skill cards drop between waves — stack synergistic builds for high scores. Co-op multiplier kicks in when reviving teammates. Rebind any key under Settings > Keybind.' },
        ],
      });
    }
