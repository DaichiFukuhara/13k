# Random Duel Rainbow — Game Guide

Play as a unicorn whose single horn can copy one defeated enemy's move.
Read the opponent's windup, make space, and punish an opening.

See the [main README](../README.md) for setup and the full control table,
or the [development guide](../docs/DEVELOPMENT.md) for builds and tests.

## Combat

- **Parry:** press K or X while free to act. Reception begins on the same game update
  and lasts 12 updates (about 0.2 seconds at 60 Hz). Parryable attacks show a white
  outline during the final 11 windup updates.
- **Melee:** Sweep, Thrust, Slam and Charge can be parried. Success interrupts the
  enemy's combo, removes 8 posture and opens 42 updates for a counterattack.
- **Projectiles:** a successful parry reflects the shot. Falling Rain attacks must
  be avoided instead.
- **Posture:** empty the enemy's posture bar to create a longer, 110-update opening.
- **Stamina:** parrying costs 18 and rolling costs 24. A failed parry still has
  recovery. Holding the button does not automatically parry again, and attacks
  cannot be cancelled into a parry.
- **Attack timing:** the starting horn thrust comes out in 7 updates. Stolen moves
  keep their own windup and recovery, so a heavy Slam needs a bigger opening.

## Copying a move

After a victory, choose with A/D or the arrow keys. Press **T** to try a move
against a harmless target. Attack with J/Z, return to the choices with R, or
confirm with Enter. Trial damage and parries do not change your run statistics.

You can confirm directly without entering a trial. The target resets after you
finish attacking, so you can compare a move repeatedly. Attack-button mashing
at the end of a fight will not accidentally enter the trial.

Your move's total base HP damage is normalized across its hits. Switch for its
reach, timing, movement or posture effect, rather than a straight damage upgrade.
Your horn always holds one move.

## Runs, retries and seeds

Defeat three guardians to restore the rainbow. From the results, press Enter
to continue into **Prism Ascent**. Enemy HP and posture increase with each foe;
generation difficulty rises through four capped levels. A mutated boss and a
record screen appear every third victory. Your best clear count is saved in the browser.

| Screen | Action |
| --- | --- |
| Title | Enter starts; N chooses a new seed |
| Defeat | Enter / R retries the same foe; N starts a new seed |
| Pause | Enter / Escape resumes; R restarts the seed from the first foe; N returns to the title with a new seed |
| Results | Enter continues the ascent; R restarts the same seed; N starts a new run |

Pause also works during trials. Losing browser focus pauses the game.

The URL parameter `?seed=TEST01` selects a base-36 seed. The same seed reproduces
the same opponents and background melody. Music gains layers as you progress
through each group of three foes.

## Sound lab

Open [soundcheck.html](soundcheck.html) through your local server to compare
attacks, impacts, counters, parries, posture breaks and victory melodies.
You can render two loops of seeded music or export a four-sound WAV comparison.
This development tool is excluded from the submission ZIP.
