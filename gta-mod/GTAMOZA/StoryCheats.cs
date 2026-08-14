using System;
using System.IO;
using System.Windows.Forms;
using GTA;
using GTA.Math;
using GTA.Native;
using UiScreen = GTA.UI.Screen;

namespace GTAMOZA
{
    /// <summary>
    /// Optional Story Mode helpers (god / no police / spawn car / time of day).
    /// Controlled by %TEMP%\gtamoza_cheats.json from the GTAMOZA app — off by default.
    /// </summary>
    public class StoryCheats : Script
    {
        static readonly string ConfigPath =
            Path.Combine(Path.GetTempPath(), "gtamoza_cheats.json");

        static readonly int[] TimeHours = { 6, 12, 18, 22, 0 };
        static readonly string[] TimeLabels =
        {
            "Morning", "Day", "Evening", "Night", "Midnight",
        };

        bool _godOn;
        bool _noCopsOn;
        Vehicle _spawned;
        long _lastConfigRead;
        bool _masterEnabled;
        bool _godEnabled = true;
        bool _copsEnabled = true;
        bool _spawnEnabled = true;
        bool _timeEnabled = true;
        Keys _godKey = Keys.Home;
        Keys _copsKey = Keys.End;
        Keys _spawnKey = Keys.PageUp;
        Keys _timeKey = Keys.Oemplus;
        int _timeSlot = -1;

        static readonly VehicleHash[] Cars =
        {
            VehicleHash.Adder, VehicleHash.Zentorno, VehicleHash.T20, VehicleHash.Osiris,
            VehicleHash.EntityXF, VehicleHash.Comet2, VehicleHash.Elegy2, VehicleHash.SultanRS,
            VehicleHash.Banshee2, VehicleHash.Kuruma2, VehicleHash.Insurgent, VehicleHash.Sandking,
            VehicleHash.Bodhi2, VehicleHash.Dominator, VehicleHash.Gauntlet, VehicleHash.Nero,
            VehicleHash.Tempesta, VehicleHash.Vacca, VehicleHash.Bullet, VehicleHash.Carbonizzare,
            VehicleHash.Feltzer2, VehicleHash.Jester, VehicleHash.Massacro, VehicleHash.Alpha,
            VehicleHash.Blista, VehicleHash.Futo, VehicleHash.Issi2, VehicleHash.Panto,
            VehicleHash.Buffalo, VehicleHash.Dominator2,
        };

        static readonly Random Rng = new Random();

        public StoryCheats()
        {
            Interval = 0;
            Tick += OnTick;
            KeyUp += OnKeyUp;
            Aborted += (_, __) => CleanupSpawn();
            ReloadConfig(true);
        }

        void OnTick(object sender, EventArgs e)
        {
            if ((_frame++ & 31) == 0) ReloadConfig(false);
            if (!_masterEnabled) return;

            try
            {
                var player = Game.Player;
                var ped = player.Character;
                if (ped == null || !ped.Exists()) return;

                if (_godEnabled && _godOn)
                {
                    Function.Call(Hash.SET_PLAYER_INVINCIBLE, player, true);
                    Function.Call(Hash.SET_ENTITY_INVINCIBLE, ped, true);
                    Function.Call(Hash.SET_ENTITY_PROOFS, ped, true, true, true, true, true, true, true, true);
                }

                if (_copsEnabled && _noCopsOn)
                {
                    Function.Call(Hash.SET_MAX_WANTED_LEVEL, 0);
                    Function.Call(Hash.CLEAR_PLAYER_WANTED_LEVEL, player);
                    Function.Call(Hash.SET_POLICE_IGNORE_PLAYER, player, true);
                    Function.Call(Hash.SET_DISPATCH_COPS_FOR_PLAYER, player, false);
                }
            }
            catch { /* ignore */ }
        }

        int _frame;

        void OnKeyUp(object sender, KeyEventArgs e)
        {
            ReloadConfig(false);
            if (!_masterEnabled) return;

            if (_godEnabled && e.KeyCode == _godKey)
            {
                _godOn = !_godOn;
                if (!_godOn) ClearGod();
                UiScreen.ShowSubtitle(_godOn ? "~g~God mode~s~ ON" : "~o~God mode~s~ OFF", 1800);
                return;
            }

            if (_copsEnabled && e.KeyCode == _copsKey)
            {
                _noCopsOn = !_noCopsOn;
                if (!_noCopsOn) ClearCops();
                UiScreen.ShowSubtitle(_noCopsOn ? "~g~Police~s~ OFF" : "~o~Police~s~ ON", 1800);
                return;
            }

            if (_spawnEnabled && e.KeyCode == _spawnKey)
            {
                SpawnRandomCar();
                return;
            }

            if (_timeEnabled && e.KeyCode == _timeKey)
                CycleTimeOfDay();
        }

        void ClearGod()
        {
            try
            {
                var player = Game.Player;
                var ped = player.Character;
                Function.Call(Hash.SET_PLAYER_INVINCIBLE, player, false);
                if (ped != null && ped.Exists())
                {
                    Function.Call(Hash.SET_ENTITY_INVINCIBLE, ped, false);
                    Function.Call(Hash.SET_ENTITY_PROOFS, ped, false, false, false, false, false, false, false, false);
                }
            }
            catch { /* ignore */ }
        }

        void ClearCops()
        {
            try
            {
                var player = Game.Player;
                Function.Call(Hash.SET_MAX_WANTED_LEVEL, 5);
                Function.Call(Hash.SET_POLICE_IGNORE_PLAYER, player, false);
                Function.Call(Hash.SET_DISPATCH_COPS_FOR_PLAYER, player, true);
            }
            catch { /* ignore */ }
        }

        void SpawnRandomCar()
        {
            try
            {
                var ped = Game.Player.Character;
                if (ped == null || !ped.Exists()) return;

                var hash = Cars[Rng.Next(Cars.Length)];
                var model = new Model(hash);
                if (!model.IsValid || !model.Request(3000)) return;

                CleanupSpawn();
                var pos = ped.Position + ped.ForwardVector * 5.5f;
                var veh = World.CreateVehicle(model, pos, ped.Heading);
                model.MarkAsNoLongerNeeded();
                if (veh == null || !veh.Exists()) return;

                veh.PlaceOnGround();
                veh.IsEngineRunning = true;
                ped.SetIntoVehicle(veh, VehicleSeat.Driver);
                _spawned = veh;
                UiScreen.ShowSubtitle("~y~" + hash + "~s~", 1800);
            }
            catch { /* ignore */ }
        }

        void CycleTimeOfDay()
        {
            try
            {
                _timeSlot = (_timeSlot + 1) % TimeHours.Length;
                int hour = TimeHours[_timeSlot];
                Function.Call(Hash.SET_CLOCK_TIME, hour, 0, 0);
                UiScreen.ShowSubtitle(
                    "~y~" + TimeLabels[_timeSlot] + "~s~  " + hour.ToString("00") + ":00",
                    1800);
            }
            catch { /* ignore */ }
        }

        void CleanupSpawn()
        {
            try
            {
                if (_spawned != null && _spawned.Exists())
                    _spawned.Delete();
            }
            catch { /* ignore */ }
            _spawned = null;
        }

        void ReloadConfig(bool force)
        {
            long now = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
            if (!force && now - _lastConfigRead < 800) return;
            _lastConfigRead = now;

            try
            {
                if (!File.Exists(ConfigPath))
                {
                    _masterEnabled = false;
                    return;
                }
                var json = File.ReadAllText(ConfigPath);
                _masterEnabled = ReadBool(json, "enabled", false);
                _godEnabled = ReadBool(json, "godEnabled", true);
                _copsEnabled = ReadBool(json, "copsEnabled", true);
                _spawnEnabled = ReadBool(json, "spawnEnabled", true);
                _timeEnabled = ReadBool(json, "timeEnabled", true);
                _godKey = ParseKey(ReadString(json, "godHotkey", "Home"), Keys.Home);
                _copsKey = ParseKey(ReadString(json, "copsHotkey", "End"), Keys.End);
                _spawnKey = ParseKey(ReadString(json, "spawnHotkey", "PageUp"), Keys.PageUp);
                _timeKey = ParseKey(ReadString(json, "timeHotkey", "Oemplus"), Keys.Oemplus);

                if (!_masterEnabled)
                {
                    if (_godOn) { _godOn = false; ClearGod(); }
                    if (_noCopsOn) { _noCopsOn = false; ClearCops(); }
                }
            }
            catch
            {
                _masterEnabled = false;
            }
        }

        static Keys ParseKey(string name, Keys fallback)
        {
            if (string.IsNullOrWhiteSpace(name)) return fallback;
            Keys k;
            if (Enum.TryParse(name.Trim(), true, out k)) return k;
            return fallback;
        }

        static bool ReadBool(string json, string key, bool fallback)
        {
            string token = "\"" + key + "\":";
            int i = json.IndexOf(token, StringComparison.Ordinal);
            if (i < 0) return fallback;
            i += token.Length;
            while (i < json.Length && char.IsWhiteSpace(json[i])) i++;
            if (i < json.Length && json.Substring(i).StartsWith("true", StringComparison.OrdinalIgnoreCase))
                return true;
            if (i < json.Length && json.Substring(i).StartsWith("false", StringComparison.OrdinalIgnoreCase))
                return false;
            return fallback;
        }

        static string ReadString(string json, string key, string fallback)
        {
            string token = "\"" + key + "\":";
            int i = json.IndexOf(token, StringComparison.Ordinal);
            if (i < 0) return fallback;
            i += token.Length;
            while (i < json.Length && char.IsWhiteSpace(json[i])) i++;
            if (i >= json.Length || json[i] != '"') return fallback;
            i++;
            int start = i;
            while (i < json.Length && json[i] != '"') i++;
            if (i <= start) return fallback;
            return json.Substring(start, i - start);
        }
    }
}
