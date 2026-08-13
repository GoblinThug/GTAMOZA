using System;
using System.IO;
using System.Net;
using System.Net.Sockets;
using System.Text;
using GTA;
using GTA.Math;
using GTA.Native;
using UiScreen = GTA.UI.Screen;

namespace GTAMOZA
{
    /// <summary>
    /// Bidirectional bridge with GTAMOZA app:
    /// - OUT telemetry UDP 29755
    /// - IN  controls  UDP 29757 + %TEMP%\gtamoza_controls.json
    /// </summary>
    public class Bridge : Script
    {
        const int TelemetryPort = 29755;
        const int ControlPort = 29757;

        // INPUT_VEH_* 
        const int CtrlAccel = 71;
        const int CtrlBrake = 72;
        const int CtrlHandbrake = 76;
        const int CtrlMoveLR = 59;
        const int CtrlMoveUD = 61;

        static readonly string ControlsPath =
            Path.Combine(Path.GetTempPath(), "gtamoza_controls.json");
        static readonly string LogPath =
            Path.Combine(Path.GetTempPath(), "gtamoza_plugin.log");

        readonly UdpClient _tx = new UdpClient();
        readonly IPEndPoint _telemetryEp = new IPEndPoint(IPAddress.Loopback, TelemetryPort);
        readonly StringBuilder _sb = new StringBuilder(512);

        UdpClient _rx;
        Vector3 _prevVelocity;
        float _prevSpeed;
        int _frame;
        long _lastLogMs;
        float _collisionPulse;
        float _collisionHard = 0.55f;
        float _prevBodyHealth = -1f;
        float _prevVert;
        string _prevSurfMid = "asphalt";
        int _prevWheelsDown = 4;

        float _steer;
        float _throttle;
        float _brake;
        float _clutch;
        float _steerSm;
        float _prevSteerSm;
        float _throttleSm;
        float _brakeSm;
        /// <summary>MOZA clutch-paddle turn signals from Electron.</summary>
        bool _indL;
        bool _indR;
        bool _prevIndL;
        bool _prevIndR;
        /// <summary>0 = FiveM-style (0=L,1=R), 1 = SHVDN-style (true=L,false=R).</summary>
        int _indNativeMode = -1;
        bool _indNativeBroken;
        int _handlingVehHandle;
        float _handlingSteerLockSaved = -1f;
        /// <summary>Reached a full stop (may still be holding the first brake).</summary>
        bool _stopped;
        /// <summary>Must release brake after stop before reverse can arm.</summary>
        bool _needBrakeRelease;
        /// <summary>Second brake press while stopped → reverse.</summary>
        bool _reverse;
        bool _brakePrev;
        long _controlsAt;
        bool _hasControls;
        int _packets;

        public Bridge()
        {
            Interval = 0;
            Tick += OnTick;
            Aborted += OnAborted;
            TryBindReceiver();
            Log("Bridge started");
            // Visible after F11 / SHVDN script reload so the player knows the mod is live.
            try
            {
                UiScreen.ShowSubtitle("~b~GTAMOZA~s~ ~g~Hot-reload OK~s~", 2800);
                GTA.UI.Notification.PostTicker("~b~GTAMOZA~s~: Hot-reload OK", true);
            }
            catch { }
        }

        void TryBindReceiver()
        {
            try
            {
                _rx = new UdpClient(new IPEndPoint(IPAddress.Loopback, ControlPort));
                _rx.Client.Blocking = false;
                _rx.Client.ReceiveBufferSize = 1 << 20;
                Log("UDP control listen OK on " + ControlPort);
            }
            catch (Exception ex)
            {
                _rx = null;
                Log("UDP bind failed (file fallback only): " + ex.Message);
            }
        }

        void OnAborted(object sender, EventArgs e)
        {
            RestoreSteeringLock();
            try { _tx?.Close(); } catch { }
            try { _rx?.Close(); } catch { }
            Log("Bridge aborted");
        }

        void OnTick(object sender, EventArgs e)
        {
            _frame++;
            try { PollControls(); }
            catch (Exception ex) { LogRare("poll: " + ex.Message); }

            try { ApplyControls(); }
            catch (Exception ex) { LogRare("apply: " + ex.Message); }

            // Indicators run even if ApplyControls early-outs (stale pedals) — keeps NPC-style blink
            try { ApplyIndicators(); }
            catch (Exception ex) { LogRare("indicators: " + ex.Message); }

            if ((_frame & 1) == 0)
            {
                try { SendSample(); }
                catch (Exception ex) { LogRare("telemetry: " + ex.Message); }
            }
        }

        void PollControls()
        {
            bool gotUdp = false;
            if (_rx != null)
            {
                while (_rx.Available > 0)
                {
                    IPEndPoint remote = null;
                    byte[] data = _rx.Receive(ref remote);
                    if (data == null || data.Length < 3) continue;
                    ParseControls(Encoding.UTF8.GetString(data));
                    _packets++;
                    gotUdp = true;
                }
            }

            // File is only a fallback. Reading it after UDP used to overwrite fresh
            // steer with a value up to ~80ms stale → front wheels twitch L/R while turning.
            if (gotUdp) return;

            try
            {
                if (File.Exists(ControlsPath))
                {
                    var json = File.ReadAllText(ControlsPath);
                    if (!string.IsNullOrEmpty(json)) ParseControls(json);
                }
            }
            catch { /* ignore IO races */ }
        }

        void ParseControls(string json)
        {
            _steer = Clamp(ReadFloat(json, "steer", _steer), -1f, 1f);
            _throttle = Clamp(ReadFloat(json, "throttle", _throttle), 0f, 1f);
            _brake = Clamp(ReadFloat(json, "brake", _brake), 0f, 1f);
            _clutch = Clamp(ReadFloat(json, "clutch", _clutch), 0f, 1f);
            _indL = ReadFloat(json, "indL", _indL ? 1f : 0f) >= 0.5f;
            _indR = ReadFloat(json, "indR", _indR ? 1f : 0f) >= 0.5f;
            _controlsAt = NowMs();
            _hasControls = true;
        }

        void ApplyControls()
        {
            if (!_hasControls) return;
            if (NowMs() - _controlsAt > 400)
            {
                _throttle = 0f;
                _brake = 0f;
                _throttleSm = 0f;
                _brakeSm = 0f;
                _reverse = false;
                _stopped = false;
                _needBrakeRelease = false;
                return;
            }

            var ped = Game.Player.Character;
            if (ped == null || !ped.Exists())
            {
                RestoreSteeringLock();
                return;
            }
            var veh = ped.CurrentVehicle;
            if (veh == null || !veh.Exists() || veh.Driver != ped)
            {
                RestoreSteeringLock();
                return;
            }

            // Sharp lane-changes must be 1:1. Only micro-smooth when holding steady.
            float steerDelta = Math.Abs(_steer - _steerSm);
            if (steerDelta > 0.035f)
                _steerSm = _steer;
            else
                _steerSm += (_steer - _steerSm) * 0.82f;
            if (Math.Abs(_steerSm) < 0.002f) _steerSm = 0f;
            _throttleSm += (_throttle - _throttleSm) * 0.55f;
            _brakeSm += (_brake - _brakeSm) * 0.5f;

            // SoftPedal gamma > 1 made pedals dead until mid-travel (pow 1.55 / 1.35).
            // gamma < 1 → bite from the top of the stroke, like the steer reshape.
            float drive = SoftPedal(_throttleSm, 0.82f) * 0.95f;
            float brakeIn = SoftPedal(_brakeSm, 0.88f) * 0.9f;

            float signedSpeed = 0f;
            try { signedSpeed = Vector3.Dot(veh.Velocity, veh.ForwardVector); }
            catch { signedSpeed = veh.Speed; }
            float absSpeed = Math.Abs(signedSpeed);

            bool brakeDown = _brakeSm > 0.16f;
            bool brakeUp = _brakeSm < 0.08f;
            bool gasDown = _throttleSm > 0.10f;
            bool brakeEdge = brakeDown && !_brakePrev;
            _brakePrev = brakeDown;

            // --- Reverse: stop → release brake → press brake again ---
            if (gasDown)
            {
                _reverse = false;
                _stopped = false;
                _needBrakeRelease = false;
            }
            else if (absSpeed > 1.2f && signedSpeed > 0.5f)
            {
                // Moving forward — cancel reverse intent
                _reverse = false;
                _stopped = false;
                _needBrakeRelease = false;
            }
            else if (absSpeed < 0.45f)
            {
                if (!_stopped)
                {
                    _stopped = true;
                    _needBrakeRelease = brakeDown; // must lift pedal if still holding stop-brake
                }

                if (_stopped && _needBrakeRelease && brakeUp)
                    _needBrakeRelease = false;

                // Second press (edge) engages reverse; stays until gas
                if (_stopped && !_needBrakeRelease && !_reverse && brakeEdge)
                    _reverse = true;
            }

            float accelOut = drive;
            float brakeOut = brakeIn;
            bool holdPark = false;

            if (_reverse)
            {
                // Native GTA reverse = BRAKE axis while stopped/reversing.
                // Never inject Accel here — that torques forward and wheelies the nose up.
                accelOut = 0f;
                brakeOut = brakeDown ? SoftPedal(_brakeSm, 1.1f) * 0.80f : 0f;
            }
            else if (_stopped && _needBrakeRelease && brakeDown)
            {
                // First brake still held after stop — park, no reverse
                accelOut = 0f;
                brakeOut = 0f;
                holdPark = true;
            }

            // GTA rate-limits pad steer (and FP wheel anim) for controllers. Disable that
            // path and drive angle/scale ourselves so flicks aren't one beat late.
            try
            {
                Function.Call(Hash.DISABLE_CONTROL_ACTION, 0, CtrlMoveLR, true);
                Function.Call(Hash.DISABLE_CONTROL_ACTION, 2, CtrlMoveLR, true);
            }
            catch { }

            try
            {
                // SteeringLock memory = radians. Raise slightly for sharper car yaw (never degrees).
                EnsureSteerLockRadians(veh);

                // Direct axis — Electron already curves; don't double-soften here.
                float shaped = Clamp(_steerSm, -1f, 1f);
                // Flick / lane-change: push the car into yaw harder than the rim angle alone
                if (steerDelta > 0.03f)
                    shaped = Clamp(shaped * 1.22f, -1f, 1f);
                else if (Math.Abs(shaped) > 0.08f && Math.Abs(shaped) < 0.55f)
                    shaped = Clamp(shaped * 1.12f, -1f, 1f);
                _prevSteerSm = _steerSm;

                // Match handling lock (50° = ~0.873 rad)
                const float lockDeg = 50f;
                veh.SteeringAngle = shaped * lockDeg;
                veh.SteeringScale = shaped;
            }
            catch { }

            InjectAxis(0, CtrlAccel, accelOut);
            InjectAxis(2, CtrlAccel, accelOut);
            InjectAxis(0, CtrlBrake, brakeOut);
            InjectAxis(2, CtrlBrake, brakeOut);

            if (_clutch > 0.55f || holdPark)
            {
                float hb = _clutch > 0.55f ? _clutch : 0.9f;
                InjectAxis(0, CtrlHandbrake, hb);
                InjectAxis(2, CtrlHandbrake, hb);
            }

            // No SET_VEHICLE_FORWARD_SPEED — it yanked the chassis and lifted the front.

            try
            {
                if (!veh.IsEngineRunning && (drive > 0.05f || (_reverse && brakeDown)))
                    veh.IsEngineRunning = true;
            }
            catch { }

        }

        /// <summary>
        /// Turn signals every frame. Probe once which native arg convention works
        /// (FiveM 0/1 vs SHVDN true/false). When native sticks, leave the flag ON and
        /// let GTA's own ~1s blink run. Only software-blink (300ms) for high-beam fallback.
        /// </summary>
        void ApplyIndicators()
        {
            if (!_hasControls) return;
            if (NowMs() - _controlsAt > 2500) return;

            var ped = Game.Player.Character;
            if (ped == null || !ped.Exists()) return;
            var veh = ped.CurrentVehicle;
            if (veh == null || !veh.Exists() || veh.Driver != ped) return;

            int handle = veh.Handle;
            bool wantL = _indL;
            bool wantR = _indR;
            // Soft blink only for HL fallback (0.3s half-period). Native path stays steady ON.
            bool phaseOn = ((Game.GameTime / 300) & 1) == 0;
            bool leftLit = wantL;
            bool rightLit = wantR;
            if (_indNativeBroken)
            {
                leftLit = wantL && phaseOn;
                rightLit = wantR && phaseOn;
            }

            try
            {
                if (_indNativeMode < 0 && (wantL || wantR))
                {
                    // Probe: FiveM docs / many scripts use 0=left, 1=right
                    Function.Call(Hash.SET_VEHICLE_INDICATOR_LIGHTS, handle, 0, true);
                    Function.Call(Hash.SET_VEHICLE_INDICATOR_LIGHTS, handle, 1, false);
                    bool bitL = false;
                    try { bitL = veh.IsLeftIndicatorLightOn; } catch { }
                    if (bitL)
                    {
                        _indNativeMode = 0;
                        Log("indicator native mode=FiveM(0=L,1=R) readback OK");
                    }
                    else
                    {
                        Function.Call(Hash.SET_VEHICLE_INDICATOR_LIGHTS, handle, true, true);
                        Function.Call(Hash.SET_VEHICLE_INDICATOR_LIGHTS, handle, false, false);
                        try { bitL = veh.IsLeftIndicatorLightOn; } catch { bitL = false; }
                        if (bitL)
                        {
                            _indNativeMode = 1;
                            Log("indicator native mode=SHVDN(true=L) readback OK");
                        }
                        else
                        {
                            _indNativeMode = 0; // still try FiveM; mark broken for HL fallback
                            _indNativeBroken = true;
                            Log("indicator native readback FAILED — using high-beam fallback");
                        }
                    }
                }

                if (_indNativeMode == 1)
                {
                    // Enhanced: SHVDN true/false is visually swapped vs property names
                    Function.Call(Hash.SET_VEHICLE_INDICATOR_LIGHTS, handle, true, rightLit);
                    Function.Call(Hash.SET_VEHICLE_INDICATOR_LIGHTS, handle, false, leftLit);
                    try
                    {
                        veh.IsLeftIndicatorLightOn = rightLit;
                        veh.IsRightIndicatorLightOn = leftLit;
                    }
                    catch { }
                }
                else
                {
                    // FiveM docs say 0=L,1=R — on Enhanced that pair is also swapped
                    Function.Call(Hash.SET_VEHICLE_INDICATOR_LIGHTS, handle, 0, rightLit);
                    Function.Call(Hash.SET_VEHICLE_INDICATOR_LIGHTS, handle, 1, leftLit);
                }

                if (_indNativeBroken && (wantL || wantR))
                {
                    try { veh.AreHighBeamsOn = phaseOn; }
                    catch
                    {
                        try { Function.Call(Hash.SET_VEHICLE_FULLBEAM, handle, phaseOn); }
                        catch { }
                    }
                }
                else if (_indNativeBroken && !wantL && !wantR)
                {
                    try { veh.AreHighBeamsOn = false; } catch { }
                }
            }
            catch (Exception ex)
            {
                LogRare("indicators apply: " + ex.Message);
            }

            if (_indL != _prevIndL || _indR != _prevIndR)
            {
                _prevIndL = _indL;
                _prevIndR = _indR;
                string label =
                    _indL && _indR ? "HAZARDS" :
                    _indL ? "LEFT" :
                    _indR ? "RIGHT" :
                    "OFF";
                Log("indicators " + label + " L=" + _indL + " R=" + _indR + " mode=" + _indNativeMode + " broken=" + _indNativeBroken);
            }
        }

        static float SoftPedal(float x, float gamma)
        {
            if (x <= 0f) return 0f;
            if (x >= 1f) return 1f;
            return (float)Math.Pow(x, gamma);
        }

        /// <summary>
        /// Mild center bite only — heavy sqrt reshape + Electron gamma made noisy mid-steer.
        /// </summary>
        static float ReshapeSteerForGta(float x)
        {
            float ax = Math.Abs(x);
            if (ax < 0.002f) return 0f;
            float t = (ax - 0.002f) / 0.998f;
            if (t > 1f) t = 1f;
            // Mostly linear; tiny lift near center for GTA's dead response
            float shaped = t * 0.82f + (float)Math.Sqrt(t) * 0.18f;
            return Math.Sign(x) * shaped;
        }

        /// <summary>
        /// SHVDN: fSteeringLock is radians in memory (~0.6–0.8 stock).
        /// Degrees (40/62/72) = 360° spin bug. Raise only within safe radian range.
        /// </summary>
        void EnsureSteerLockRadians(Vehicle veh)
        {
            try
            {
                var data = veh.HandlingData;
                if (data == null) return;

                int h = veh.Handle;
                if (_handlingVehHandle != h)
                {
                    RestoreSteeringLock();
                    _handlingVehHandle = h;
                    float saved = data.SteeringLock;
                    // If already corrupted from an old session, don't snapshot the bad value
                    _handlingSteerLockSaved = saved > 2.5f ? 0.70f : saved;
                }

                if (data.SteeringLock > 2.5f)
                {
                    data.SteeringLock = _handlingSteerLockSaved > 0.15f && _handlingSteerLockSaved <= 2.5f
                        ? _handlingSteerLockSaved
                        : 0.70f;
                    return;
                }

                // 50° in radians (π/180 * 50)
                const float wantRad = 0.87266463f;
                if (Math.Abs(data.SteeringLock - wantRad) > 0.01f && data.SteeringLock <= 2.5f)
                    data.SteeringLock = wantRad;
            }
            catch { /* handling optional */ }
        }

        void RestoreSteeringLock()
        {
            if (_handlingVehHandle == 0 || _handlingSteerLockSaved < 0f) return;
            try
            {
                var v = (Vehicle)Entity.FromHandle(_handlingVehHandle);
                if (v != null && v.Exists() && v.HandlingData != null)
                {
                    float restore = _handlingSteerLockSaved;
                    if (restore > 2.5f) restore = 0.70f;
                    v.HandlingData.SteeringLock = restore;
                }
            }
            catch { /* ignore */ }
            _handlingVehHandle = 0;
            _handlingSteerLockSaved = -1f;
        }

        static void InjectAxis(int pad, int control, float value)
        {
            // SET_CONTROL_NORMAL — works for scripted analog input on Story Mode
            Function.Call((Hash)0xE8A25867FBA3B05EUL, pad, control, value);
        }

        void SendSample()
        {
            var ped = Game.Player.Character;
            if (ped == null || !ped.Exists())
            {
                EmitIdle();
                return;
            }

            var veh = ped.CurrentVehicle;
            if (veh == null || !veh.Exists())
            {
                EmitIdle();
                return;
            }

            var vel = veh.Velocity;
            float speed = vel.Length();
            var dVel = (vel - _prevVelocity) * 60f;
            var fwd = veh.ForwardVector;
            var right = veh.RightVector;
            float accelFwd = Vector3.Dot(dVel, fwd);
            float accelLat = Vector3.Dot(dVel, right);
            float accel = (speed - _prevSpeed) * 60f;
            _prevSpeed = speed;

            float vertDelta = (vel.Z - _prevVert) * 60f;
            _prevVert = vel.Z;
            _prevVelocity = vel;

            // Keep legacy "lateral" as lateral accel for older app builds
            float lateral = accelLat;

            var rotVel = veh.LocalRotationVelocity;
            float yawRate = rotVel.Z;
            float pitchRate = rotVel.X;
            float rollRate = rotVel.Y;

            float rpm = SafeFloat(() => veh.CurrentRPM, 0f);
            int gear = SafeInt(() => veh.CurrentGear, 0);
            float steer = _hasControls ? _steer : Clamp(SafeFloat(() => veh.SteeringAngle, 0f) / 45f, -1f, 1f);
            float throttle = _hasControls ? _throttle : 0f;
            float brake = _hasControls ? _brake : 0f;

            float wheelSpeed = SafeFloat(() => veh.WheelSpeed, speed);
            float wheelSlip = EstimateSlip(veh, speed, wheelSpeed, yawRate, brake);
            float tireHeat = SampleTireHeat(veh);

            bool onAllWheels = true;
            try { onAllWheels = veh.IsOnAllWheels; } catch { }
            bool airborne = !onAllWheels;
            int wheelsDown = CountWheelsDown(veh);
            if (wheelsDown < 0) wheelsDown = onAllWheels ? 4 : 2;

            string surfL, surfMid, surfR;
            int matId;
            SampleSurfaces(veh, out surfL, out surfMid, out surfR, out matId);
            string surface = CombineSurface(surfL, surfMid, surfR);

            float bump = Clamp(Math.Abs(vertDelta) / 12f, 0f, 1f);
            if (bump < 0.08f) bump = 0f;
            // Spike when landing / material changes under the car
            if (_prevWheelsDown < 3 && wheelsDown >= 3 && speed > 2f)
                bump = Math.Max(bump, Clamp(speed / 22f, 0.2f, 0.75f));
            if (surfMid != _prevSurfMid && speed > 3f)
                bump = Math.Max(bump, 0.18f);
            _prevSurfMid = surfMid;
            _prevWheelsDown = wheelsDown;

            float hitHard;
            float hit = EstimateCollision(veh, speed, accel, accelFwd, accelLat, out hitHard);
            // Hold the peak a bit longer so Electron sees a clear spike
            _collisionPulse = Math.Max(_collisionPulse * 0.82f, hit);
            if (hit > 0.06f) _collisionHard = hitHard;

            string name = SafeString(() => veh.DisplayName, "Vehicle");

            _sb.Clear();
            _sb.Append("{\"v\":2");
            _sb.Append(",\"t\":").Append(NowMs());
            _sb.Append(",\"inVehicle\":true");
            _sb.Append(",\"speed\":").Append(F(speed));
            _sb.Append(",\"rpm\":").Append(F(rpm));
            _sb.Append(",\"gear\":").Append(gear);
            _sb.Append(",\"steer\":").Append(F(steer));
            _sb.Append(",\"throttle\":").Append(F(throttle));
            _sb.Append(",\"brake\":").Append(F(brake));
            _sb.Append(",\"lateral\":").Append(F(lateral));
            _sb.Append(",\"yawRate\":").Append(F(yawRate));
            _sb.Append(",\"wheelSlip\":").Append(F(wheelSlip));
            _sb.Append(",\"collision\":").Append(F(_collisionPulse));
            _sb.Append(",\"colHard\":").Append(F(_collisionHard));
            _sb.Append(",\"bump\":").Append(F(bump));
            _sb.Append(",\"surface\":\"").Append(Esc(surface)).Append('"');
            _sb.Append(",\"vehicle\":\"").Append(Esc(name)).Append('"');
            _sb.Append(",\"wheelSpeed\":").Append(F(wheelSpeed));
            _sb.Append(",\"accelFwd\":").Append(F(accelFwd));
            _sb.Append(",\"accelLat\":").Append(F(accelLat));
            _sb.Append(",\"pitchRate\":").Append(F(pitchRate));
            _sb.Append(",\"rollRate\":").Append(F(rollRate));
            _sb.Append(",\"airborne\":").Append(airborne ? "true" : "false");
            _sb.Append(",\"wheelsDown\":").Append(wheelsDown);
            _sb.Append(",\"tireHeat\":").Append(F(tireHeat));
            _sb.Append(",\"surfL\":\"").Append(Esc(surfL)).Append('"');
            _sb.Append(",\"surfR\":\"").Append(Esc(surfR)).Append('"');
            _sb.Append(",\"matId\":").Append(matId);
            _sb.Append(",\"ctrl\":").Append(_hasControls ? "true" : "false");
            _sb.Append(",\"pkt\":").Append(_packets);
            _sb.Append('}');

            var bytes = Encoding.UTF8.GetBytes(_sb.ToString());
            _tx.Send(bytes, bytes.Length, _telemetryEp);
        }

        void EmitIdle()
        {
            _prevSpeed = 0f;
            _prevVelocity = Vector3.Zero;
            _prevSurfMid = "asphalt";
            _prevWheelsDown = 4;
            var json =
                "{\"v\":2,\"t\":" + NowMs() +
                ",\"inVehicle\":false,\"speed\":0,\"rpm\":0,\"gear\":0,\"steer\":0,\"throttle\":0,\"brake\":0,\"lateral\":0,\"yawRate\":0,\"wheelSlip\":0,\"collision\":0,\"colHard\":0.55,\"bump\":0,\"surface\":\"none\",\"vehicle\":\"\",\"wheelSpeed\":0,\"accelFwd\":0,\"accelLat\":0,\"pitchRate\":0,\"rollRate\":0,\"airborne\":false,\"wheelsDown\":0,\"tireHeat\":0,\"surfL\":\"none\",\"surfR\":\"none\",\"matId\":0,\"ctrl\":" +
                (_hasControls ? "true" : "false") + ",\"pkt\":" + _packets + "}";
            var bytes = Encoding.UTF8.GetBytes(json);
            _tx.Send(bytes, bytes.Length, _telemetryEp);
            _prevBodyHealth = -1f;
        }

        static float EstimateSlip(Vehicle veh, float speed, float wheelSpeed, float yawRate, float brake)
        {
            // Real drive-wheel vs body speed (dashboard WheelSpeed)
            float slip = 0f;
            if (speed > 1.2f || wheelSpeed > 1.2f)
            {
                float denom = Math.Max(2.5f, Math.Max(speed, wheelSpeed));
                slip = Clamp(Math.Abs(wheelSpeed - speed) / denom, 0f, 1f);
            }
            float yaw = Math.Abs(yawRate);
            if (yaw > 0.65f && speed > 4f)
                slip = Math.Max(slip, Math.Min(0.75f, (yaw - 0.65f) / 2.0f));
            // Hard brake lockup hint when wheel speed collapses vs body
            if (brake > 0.75f && speed > 3f && wheelSpeed < speed * 0.55f)
                slip = Math.Max(slip, Clamp((brake - 0.75f) * 0.85f, 0f, 0.7f));
            return Clamp(slip, 0f, 1f);
        }

        static float SampleTireHeat(Vehicle veh)
        {
            try
            {
                var wheels = veh.Wheels;
                if (wheels == null || wheels.Count == 0) return 0f;
                float sum = 0f;
                int n = 0;
                int count = Math.Min(wheels.Count, 6);
                for (int i = 0; i < count; i++)
                {
                    try
                    {
                        // Temperature rises on drift/brake/burnout; ~20 idle … ~59 burst
                        float temp = wheels[i].Temperature;
                        sum += Clamp((temp - 20f) / 40f, 0f, 1f);
                        n++;
                    }
                    catch { }
                }
                return n > 0 ? sum / n : 0f;
            }
            catch { return 0f; }
        }

        static int CountWheelsDown(Vehicle veh)
        {
            try
            {
                var wheels = veh.Wheels;
                if (wheels == null || wheels.Count == 0) return -1;
                int down = 0;
                int count = Math.Min(wheels.Count, 6);
                for (int i = 0; i < count; i++)
                {
                    try
                    {
                        if (wheels[i].IsTouchingSurface) down++;
                    }
                    catch { }
                }
                return down;
            }
            catch { return -1; }
        }

        static void SampleSurfaces(Vehicle veh, out string surfL, out string surfMid, out string surfR, out int matId)
        {
            surfL = "asphalt";
            surfMid = "asphalt";
            surfR = "asphalt";
            matId = 0;
            try
            {
                var right = veh.RightVector;
                var pos = veh.Position;
                MaterialHash leftMat;
                MaterialHash midMat;
                MaterialHash rightMat;
                surfL = ProbeMaterial(pos - right * 0.85f, out leftMat);
                surfMid = ProbeMaterial(pos, out midMat);
                surfR = ProbeMaterial(pos + right * 0.85f, out rightMat);
                matId = unchecked((int)midMat);
            }
            catch { }
        }

        static string CombineSurface(string left, string mid, string right)
        {
            int kerbHits = (left == "kerb" ? 1 : 0) + (mid == "kerb" ? 1 : 0) + (right == "kerb" ? 1 : 0);
            if (kerbHits >= 2) return "kerb";
            if (left == "dirt" || mid == "dirt" || right == "dirt") return "dirt";
            if (left == "grass" || mid == "grass" || right == "grass") return "grass";
            if (left == "sand" || mid == "sand" || right == "sand") return "sand";
            return mid == "kerb" ? "asphalt" : mid;
        }

        float EstimateCollision(Vehicle veh, float speed, float accel, float accelFwd, float accelLat, out float hardness)
        {
            hardness = 0.55f;
            float intensity = 0f;

            float body = SafeFloat(() => veh.BodyHealth, -1f);
            float dmg = 0f;
            if (body >= 0f)
            {
                if (_prevBodyHealth < 0f) _prevBodyHealth = body;
                dmg = Math.Max(0f, _prevBodyHealth - body);
                _prevBodyHealth = body;
            }

            bool collided = false;
            bool hitBuilding = false;
            try
            {
                collided = veh.HasCollided;
                hitBuilding = veh.HasCollidedWithBuildingOrAnimatedBuilding;
            }
            catch { }

            float latJolt = Math.Abs(accelLat);
            float fwdDecel = accelFwd < 0f ? -accelFwd : 0f;
            // Parked idle: velocity noise must not look like impacts (was buzzing FFB at standstill)
            if (speed < 1.4f && dmg < 1.2f && fwdDecel < 14f && latJolt < 14f)
                return 0f;
            // Catch scrapes / walls that barely move BodyHealth or miss HasCollided for a frame
            if (!collided && dmg < 0.35f && accel > -4.5f && fwdDecel < 9f && latJolt < 10f)
                return 0f;

            // Hardness from what we hit
            try
            {
                if (hitBuilding) hardness = 1f;
                else if (veh.VehicleCollidingWith != null) hardness = 0.82f;
                else if (veh.PedCollidingWith != null) hardness = 0.32f;
                else if (veh.PropCollidingWith != null) hardness = 0.58f;

                hardness = Math.Max(hardness, HardnessFromMaterial(veh.MaterialCollidingWith));
            }
            catch { }

            // Impact size: damage + jolts. Do NOT treat bare HasCollided+speed as a hard hit —
            // GTA keeps HasCollided true while scraping walls and that was yanking the rim sideways.
            float dmgHit = Clamp(dmg / 28f, 0f, 1f);
            float decelHit = accel < -4.5f ? Clamp((-accel - 4.5f) / 18f, 0f, 1f) : 0f;
            float fwdHit = fwdDecel > 8f ? Clamp((fwdDecel - 8f) / 22f, 0f, 1f) : 0f;
            float sideHit = latJolt > 9f ? Clamp((latJolt - 9f) / 20f, 0f, 1f) : 0f;
            float scrapeHit = 0f;
            if (collided && speed > 3f && dmgHit < 0.08f && decelHit < 0.12f && fwdHit < 0.12f && sideHit < 0.12f)
                scrapeHit = Clamp(speed / 40f, 0.05f, 0.22f) * (0.5f + 0.5f * hardness);

            intensity = Math.Max(dmgHit, Math.Max(decelHit, Math.Max(fwdHit, Math.Max(sideHit, scrapeHit))));
            intensity = Clamp(intensity + sideHit * 0.15f, 0f, 1f);
            intensity *= 0.42f + 0.58f * hardness;
            return Clamp(intensity, 0f, 1f);
        }

        static float HardnessFromMaterial(MaterialHash mat)
        {
            string n = mat.ToString().ToLowerInvariant();
            if (string.IsNullOrEmpty(n) || n == "none" || n == "default") return 0.5f;

            if (n.Contains("metal") || n.Contains("steel") || n.Contains("concrete") ||
                n.Contains("tarmac") || n.Contains("rock") || n.Contains("stone") ||
                n.Contains("brick") || n.Contains("marble") || n.Contains("cobble") ||
                n.Contains("ceramic") || n.Contains("tile") || n.Contains("glass") ||
                n.Contains("manhole") || n.Contains("rail"))
                return 1f;

            if (n.Contains("wood") || n.Contains("plastic") || n.Contains("rubber") ||
                n.Contains("cardboard") || n.Contains("paper"))
                return 0.4f;

            if (n.Contains("bush") || n.Contains("leaves") || n.Contains("twig") ||
                n.Contains("grass") || n.Contains("hay") || n.Contains("vegetation") ||
                n.Contains("flesh") || n.Contains("moss") || n.Contains("sand") ||
                n.Contains("mud") || n.Contains("snow") || n.Contains("dirt") ||
                n.Contains("soil") || n.Contains("marsh"))
                return 0.22f;

            if (n.Contains("gravel") || n.Contains("clay") || n.Contains("pave"))
                return 0.7f;

            return 0.55f;
        }

        static string ProbeMaterial(Vector3 pos, out MaterialHash mat)
        {
            mat = default(MaterialHash);
            var hit = World.Raycast(
                pos + new Vector3(0, 0, 0.6f),
                pos + new Vector3(0, 0, -2.8f),
                IntersectFlags.Map | IntersectFlags.Objects);
            if (!hit.DidHit) return "asphalt";
            mat = hit.MaterialHash;
            var name = mat.ToString().ToLowerInvariant();

            // Real kerb/sidewalk only — plain "concrete" is half of GTA roads (was shaking the rim).
            if (name.Contains("cobble") || name.Contains("brick") || name.Contains("pave") ||
                name.Contains("sidewalk") || name.Contains("kerb") || name.Contains("curb") ||
                name.Contains("marble") || name.Contains("tile") || name.Contains("ceramic"))
                return "kerb";

            if (name.Contains("grass") || name.Contains("bush") || name.Contains("leaves") ||
                name.Contains("vegetation"))
                return "grass";

            if (name.Contains("sand") || name.Contains("beach") || name.Contains("desert"))
                return "sand";

            // Soft shoulder / gravel verge
            if (name.Contains("dirt") || name.Contains("mud") || name.Contains("gravel") ||
                name.Contains("rock") || name.Contains("soil") || name.Contains("loose") ||
                name.Contains("clay") || name.Contains("dust"))
                return "dirt";

            // Explicit tarmac / road
            if (name.Contains("tarmac") || name.Contains("asphalt") || name.Contains("road") ||
                name.Contains("rubber") || name.Contains("paint"))
                return "asphalt";

            return "asphalt";
        }

        static float ReadFloat(string json, string key, float fallback)
        {
            string token = "\"" + key + "\":";
            int i = json.IndexOf(token, StringComparison.Ordinal);
            if (i < 0) return fallback;
            i += token.Length;
            int j = i;
            while (j < json.Length)
            {
                char c = json[j];
                if ((c >= '0' && c <= '9') || c == '-' || c == '+' || c == '.' || c == 'e' || c == 'E')
                {
                    j++;
                    continue;
                }
                break;
            }
            if (j <= i) return fallback;
            float v;
            if (float.TryParse(json.Substring(i, j - i), System.Globalization.NumberStyles.Float,
                    System.Globalization.CultureInfo.InvariantCulture, out v))
                return v;
            return fallback;
        }

        static long NowMs() => DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();

        static void Log(string msg)
        {
            try
            {
                File.AppendAllText(LogPath, DateTime.Now.ToString("HH:mm:ss.fff") + " " + msg + "\r\n");
            }
            catch { }
        }

        void LogRare(string msg)
        {
            long now = NowMs();
            if (now - _lastLogMs < 2000) return;
            _lastLogMs = now;
            Log(msg);
        }

        static float Clamp(float v, float min, float max)
        {
            if (v < min) return min;
            if (v > max) return max;
            return v;
        }

        static string F(float v) => v.ToString("0.###", System.Globalization.CultureInfo.InvariantCulture);

        static string Esc(string s)
        {
            if (string.IsNullOrEmpty(s)) return "";
            return s.Replace("\\", "\\\\").Replace("\"", "\\\"");
        }

        static float SafeFloat(Func<float> f, float fallback)
        {
            try { return f(); } catch { return fallback; }
        }

        static int SafeInt(Func<int> f, int fallback)
        {
            try { return f(); } catch { return fallback; }
        }

        static string SafeString(Func<string> f, string fallback)
        {
            try
            {
                var s = f();
                return string.IsNullOrEmpty(s) ? fallback : s;
            }
            catch { return fallback; }
        }
    }
}
