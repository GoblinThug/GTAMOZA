using System.Net;
using System.Net.Sockets;
using System.Text;
using System.Text.Json;
using Vortice.DirectInput;

namespace GTAMOZA.FfbHost;

/// <summary>
/// UDP 29756 → DirectInput ConstantForce on MOZA R5.
/// MOZA requires Exclusive acquire for actuators; HID input often still works
/// for GTAMOZA because GTA is driven via our plugin, not DirectInput.
/// </summary>
static class Program
{
    const int CmdPort = 29756;
    const int AxisPort = 29758;
    const int DiNominal = 10_000;
    /// <summary>Learned at startup: +DI force moves rim in +angle when +1.</summary>
    static int ForcePolarity = 1;
    /// <summary>
    /// DI multiplier for spring: Apply(CenterPolarity * (-norm * k)) must reduce |norm|.
    /// Defaults to ForcePolarity; calibrated at startup when possible.
    /// </summary>
    static int CenterPolarity = 1;

    [STAThread]
    static void Main()
    {
        ApplicationConfiguration.Initialize();
        using var form = new HiddenForm();
        form.ShowInTaskbar = false;
        form.WindowState = FormWindowState.Minimized;
        form.Opacity = 0;
        form.Show();
        form.Activate();

        IDirectInput8? di = null;
        IDirectInputDevice8? device = null;
        IDirectInputEffect? effect = null;

        try
        {
            di = DInput.DirectInput8Create();
            var devices = di.GetDevices(DeviceClass.GameControl, DeviceEnumerationFlags.AttachedOnly);
            Guid? picked = null;
            string pickedName = "";
            foreach (var inst in devices)
            {
                var name = inst.ProductName ?? "";
                var lower = name.ToLowerInvariant();
                if (lower.Contains("moza") || lower.Contains("r5") || lower.Contains("wheelbase") || lower.Contains("wheel"))
                {
                    picked = inst.InstanceGuid;
                    pickedName = name;
                    if (lower.Contains("moza")) break;
                }
            }

            if (picked == null)
            {
                foreach (var inst in devices)
                {
                    try
                    {
                        using var probe = di.CreateDevice(inst.InstanceGuid);
                        if ((probe.Capabilities.Flags & DeviceFlags.ForceFeedback) != 0)
                        {
                            picked = inst.InstanceGuid;
                            pickedName = inst.ProductName ?? "FFB device";
                            break;
                        }
                    }
                    catch { /* skip */ }
                }
            }

            if (picked == null)
            {
                Console.Error.WriteLine("[ffb-host] No FFB device found");
                return;
            }

            device = di.CreateDevice(picked.Value);
            device.SetDataFormat<RawJoystickState>();

            // MOZA will not enable actuators without Exclusive (see DIERR_NOTEXCLUSIVEACQUIRED).
            bool exclusive = false;
            try
            {
                device.SetCooperativeLevel(
                    form.Handle,
                    CooperativeLevel.Background | CooperativeLevel.Exclusive);
                device.Acquire();
                exclusive = true;
                Console.WriteLine("[ffb-host] Exclusive acquire OK on " + pickedName);
            }
            catch (Exception ex)
            {
                Console.Error.WriteLine("[ffb-host] Exclusive failed: " + ex.Message);
                Console.Error.WriteLine("[ffb-host] Close Pit House / other FFB apps, then retry.");
                try
                {
                    device.Unacquire();
                }
                catch { }

                try
                {
                    device.SetCooperativeLevel(
                        form.Handle,
                        CooperativeLevel.Background | CooperativeLevel.NonExclusive);
                    device.Acquire();
                    Console.WriteLine("[ffb-host] Fell back to NonExclusive (forces may be silent)");
                }
                catch (Exception ex2)
                {
                    Console.Error.WriteLine("[ffb-host] Acquire failed: " + ex2.Message);
                    return;
                }
            }

            try
            {
                device.SendForceFeedbackCommand(ForceFeedbackCommand.Reset);
            }
            catch { /* optional */ }

            try
            {
                device.SendForceFeedbackCommand(ForceFeedbackCommand.SetActuatorsOn);
                Console.WriteLine("[ffb-host] Actuators ON");
            }
            catch (Exception ex)
            {
                Console.Error.WriteLine("[ffb-host] SetActuatorsOn failed: " + ex.Message);
                if (!exclusive)
                {
                    Console.Error.WriteLine("[ffb-host] Without Exclusive, MOZA will not output force.");
                }
            }

            var cf = new ConstantForce { Magnitude = 0 };
            var effectParams = new EffectParameters
            {
                Flags = EffectFlags.Cartesian | EffectFlags.ObjectOffsets,
                Duration = int.MaxValue,
                SamplePeriod = 0,
                Gain = DiNominal,
                TriggerButton = -1,
                TriggerRepeatInterval = 0,
                StartDelay = 0,
            };
            effectParams.SetAxes(new[] { 0 }, new[] { 0 });
            effectParams.Parameters = cf;

            effect = device.CreateEffect(EffectGuid.ConstantForce, effectParams);
            effect.Start();
            Console.WriteLine("[ffb-host] ready on " + pickedName + (exclusive ? " (Exclusive)" : " (NonExclusive)"));

            try
            {
                RunStartupAngleDemo(device, effect, effectParams, cf);
            }
            catch (Exception ex)
            {
                Console.Error.WriteLine("[ffb-host] startup demo failed: " + ex.Message);
                try { ApplyMagnitude(effect, effectParams, cf, 0); } catch { }
            }

            UdpClient? udp = null;
            for (int attempt = 1; attempt <= 8; attempt++)
            {
                try
                {
                    udp = new UdpClient(new IPEndPoint(IPAddress.Loopback, CmdPort));
                    udp.Client.ReceiveTimeout = 50;
                    break;
                }
                catch (SocketException ex) when (ex.SocketErrorCode == SocketError.AddressAlreadyInUse)
                {
                    Console.Error.WriteLine($"[ffb-host] UDP {CmdPort} busy (try {attempt}/8) — waiting");
                    Thread.Sleep(350);
                }
            }
            if (udp == null)
            {
                Console.Error.WriteLine($"[ffb-host] could not bind UDP {CmdPort} — another gtamoza-ffb still running?");
                return;
            }

            using (udp)
            using (var axisUdp = new UdpClient())
            {
            var axisEp = new IPEndPoint(IPAddress.Loopback, AxisPort);
            var remote = new IPEndPoint(IPAddress.Any, 0);
            int gameMag = 0;
            double centerGain = 0.6;
            double dampGain = 0.25;
            double frictionGain = 0.15;
            double inertiaGain = 0.14;
            double springSm = 0;
            double prevNorm = 0;
            double prevDNorm = 0;
            int lastOut = int.MinValue;
            var lastBeat = DateTime.UtcNow;
            var lastAxisSend = DateTime.UtcNow;
            var lastReacqLog = DateTime.MinValue;
            var lastForceApply = DateTime.UtcNow;
            var lastEffectLog = DateTime.MinValue;
            string? effectLogPath = Environment.GetEnvironmentVariable("GTAMOZA_FFB_LOG");
            if (!string.IsNullOrWhiteSpace(effectLogPath))
            {
                Console.WriteLine("[ffb-host] effect log → " + effectLogPath);
                AppendEffectLog(effectLogPath, new Dictionary<string, object?>
                {
                    ["kind"] = "host_session",
                    ["ts"] = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds(),
                    ["iso"] = DateTime.UtcNow.ToString("o"),
                    ["forcePolarity"] = ForcePolarity,
                    ["centerPolarity"] = CenterPolarity,
                });
            }

            while (true)
            {
                try
                {
                    try { device.Poll(); }
                    catch
                    {
                        try
                        {
                            device.Acquire();
                            if ((DateTime.UtcNow - lastReacqLog).TotalSeconds > 2)
                            {
                                lastReacqLog = DateTime.UtcNow;
                                Console.WriteLine("[ffb-host] re-acquired device");
                            }
                        }
                        catch { /* keep trying */ }
                    }

                    double norm = 0;
                    double yNorm = 0;
                    double zNorm = 0;
                    double rzNorm = 0;
                    double s0Norm = 0;
                    double leftTravel = 0;
                    double rightTravel = 0;
                    uint btnMask = 0;
                    try
                    {
                        var state = device.GetCurrentState<JoystickState, RawJoystickState, JoystickUpdate>();
                        norm = (state.X - 32767.5) / 32767.5;
                        if (norm > 1) norm = 1;
                        if (norm < -1) norm = -1;
                        // Combined clutch paddles often on Y; also probe Z/Rz/Slider0
                        yNorm = (state.Y - 32767.5) / 32767.5;
                        if (yNorm > 1) yNorm = 1;
                        if (yNorm < -1) yNorm = -1;
                        zNorm = (state.Z - 32767.5) / 32767.5;
                        if (zNorm > 1) zNorm = 1;
                        if (zNorm < -1) zNorm = -1;
                        rzNorm = (state.RotationZ - 32767.5) / 32767.5;
                        if (rzNorm > 1) rzNorm = 1;
                        if (rzNorm < -1) rzNorm = -1;
                        if (state.Sliders != null && state.Sliders.Length > 0)
                        {
                            s0Norm = (state.Sliders[0] - 32767.5) / 32767.5;
                            if (s0Norm > 1) s0Norm = 1;
                            if (s0Norm < -1) s0Norm = -1;
                        }
                        // Independent clutch axes: positive travel each side (Y− / Y+ or Z/Rz)
                        leftTravel = yNorm < 0 ? -yNorm : 0;
                        rightTravel = yNorm > 0 ? yNorm : 0;
                        if (leftTravel < 0.05 && zNorm < -0.12) leftTravel = -zNorm;
                        if (rightTravel < 0.05 && zNorm > 0.12) rightTravel = zNorm;
                        var btns = state.Buttons;
                        if (btns != null)
                        {
                            int n = Math.Min(btns.Length, 32);
                            for (int bi = 0; bi < n; bi++)
                            {
                                if (btns[bi]) btnMask |= 1u << bi;
                            }
                        }
                    }
                    catch { /* keep previous */ }

                    // ~500 Hz axis feed — Exclusive mode blocks node-hid; steer + paddles/buttons
                    if ((DateTime.UtcNow - lastAxisSend).TotalMilliseconds >= 2)
                    {
                        lastAxisSend = DateTime.UtcNow;
                        try
                        {
                            var inv = System.Globalization.CultureInfo.InvariantCulture;
                            var axisJson = Encoding.UTF8.GetBytes(
                                "{\"steer\":" + norm.ToString("0.####", inv) +
                                ",\"y\":" + yNorm.ToString("0.####", inv) +
                                ",\"z\":" + zNorm.ToString("0.####", inv) +
                                ",\"rz\":" + rzNorm.ToString("0.####", inv) +
                                ",\"s0\":" + s0Norm.ToString("0.####", inv) +
                                ",\"left\":" + leftTravel.ToString("0.####", inv) +
                                ",\"right\":" + rightTravel.ToString("0.####", inv) +
                                ",\"btns\":" + btnMask + "}");
                            axisUdp.Send(axisJson, axisJson.Length, axisEp);
                        }
                        catch { /* axis optional */ }
                    }

                    while (udp.Available > 0)
                    {
                        var data = udp.Receive(ref remote);
                        var json = Encoding.UTF8.GetString(data);
                        using var doc = JsonDocument.Parse(json);
                        var root = doc.RootElement;
                        if (root.TryGetProperty("magnitude", out var magEl))
                        {
                            var mag = magEl.GetInt32();
                            if (mag > DiNominal) mag = DiNominal;
                            if (mag < -DiNominal) mag = -DiNominal;
                            gameMag = mag;
                        }
                        if (root.TryGetProperty("center", out var cEl) && cEl.TryGetDouble(out var c))
                        {
                            if (c < 0) c = 0;
                            if (c > 1) c = 1;
                            centerGain = c;
                        }
                        if (root.TryGetProperty("damp", out var dEl) && dEl.TryGetDouble(out var d))
                        {
                            if (d < 0) d = 0;
                            if (d > 1) d = 1;
                            dampGain = d;
                        }
                        if (root.TryGetProperty("friction", out var fEl) && fEl.TryGetDouble(out var f))
                        {
                            if (f < 0) f = 0;
                            if (f > 1) f = 1;
                            frictionGain = f;
                        }
                        if (root.TryGetProperty("inertia", out var iEl) && iEl.TryGetDouble(out var i))
                        {
                            if (i < 0) i = 0;
                            if (i > 1) i = 1;
                            inertiaGain = i;
                        }
                        lastBeat = DateTime.UtcNow;
                    }

                    // Stale game effects only — keep mechanical filters alive
                    if ((DateTime.UtcNow - lastBeat).TotalMilliseconds > 450)
                        gameMag = 0;

                    // MOZA-style stack: game mag + SAT spring + damper + friction + inertia
                    // "Falls off center" fix: stronger notch near 0, friction must NOT fight return.
                    double dNorm = norm - prevNorm;
                    double dAcc = dNorm - prevDNorm;
                    prevDNorm = dNorm;
                    prevNorm = norm;
                    double turnRate = Math.Abs(dNorm);
                    double absN = Math.Abs(norm);
                    double flickEase = 1.0 - Math.Min(0.25, turnRate * 14.0);
                    // Slightly heavier column (spring/damp/friction/inertia).
                    double centerNotch = 1.0 + (1.0 - Math.Min(1.0, absN / 0.22)) * 0.12;
                    double springTarget =
                        -norm * (1100 + 3600 * centerGain) * flickEase * centerNotch;
                    springSm += (springTarget - springSm) * 0.15;
                    double centerDamp = 1.0 + (1.0 - Math.Min(1.0, absN / 0.14)) * 1.4;
                    double dampRate = Math.Abs(dNorm) < 0.0004 ? 0.0 : dNorm;
                    double damper = -dampRate * (1100 + 4600 * dampGain) * centerDamp;
                    // Friction: mechanical drag, but don't oppose return-to-center
                    double friction = 0;
                    if (turnRate > 0.00012)
                    {
                        friction = -Math.Sign(dNorm) * (160 + 1700 * frictionGain);
                        bool returning =
                            Math.Abs(norm) > 0.008 &&
                            Math.Sign(dNorm) == -Math.Sign(norm);
                        if (returning) friction *= 0.12;
                    }
                    double inertia =
                        Math.Abs(dAcc) < 0.0005 ? 0.0 : -dAcc * (1000 + 5400 * inertiaGain);
                    int mechOut = (int)Math.Round(
                        CenterPolarity * (springSm + damper + friction + inertia));

                    // Let tire-model Mz through near center; mute only tiny texture noise.
                    // Impacts always punch through.
                    double gameScale = 1.0;
                    if (absN > 0.22)
                        gameScale = Math.Max(0.62, 1.0 - (absN - 0.22) * 0.95);
                    gameScale *= 0.94 + 0.06 * flickEase;
                    double gameAbs = Math.Abs(gameMag);
                    double impactBypass = Math.Min(1.0, gameAbs / 1200.0);
                    if (absN < 0.04)
                        gameScale *= 0.48 + (absN / 0.04) * 0.52 + impactBypass * 0.75;
                    gameScale = Math.Min(1.0, gameScale);
                    // Tire Mz + textures/impacts use ForcePolarity (spring uses CenterPolarity).
                    int blendedGame = (int)Math.Round(ForcePolarity * gameMag * gameScale);
                    if (Math.Abs(blendedGame) < 160 && absN < 0.06 && gameAbs < 380)
                        blendedGame = 0;
                    int output = blendedGame + mechOut;
                    if (output > DiNominal) output = DiNominal;
                    if (output < -DiNominal) output = -DiNominal;

                    // Soft slew for cruise; wide slew for impacts so hits are felt
                    int maxOutStep = gameAbs > 2800 ? 5600 : gameAbs > 1200 ? 3000 : 1200;
                    if (lastOut == int.MinValue) lastOut = 0;
                    int dOut = output - lastOut;
                    if (dOut > maxOutStep) output = lastOut + maxOutStep;
                    else if (dOut < -maxOutStep) output = lastOut - maxOutStep;

                    if (output != lastOut || (DateTime.UtcNow - lastForceApply).TotalMilliseconds > 40)
                    {
                        ApplyMagnitude(effect, effectParams, cf, output);
                        lastOut = output;
                        lastForceApply = DateTime.UtcNow;
                    }

                    if (!string.IsNullOrWhiteSpace(effectLogPath) &&
                        (DateTime.UtcNow - lastEffectLog).TotalMilliseconds >= 50)
                    {
                        lastEffectLog = DateTime.UtcNow;
                        AppendEffectLog(effectLogPath, new Dictionary<string, object?>
                        {
                            ["kind"] = "host",
                            ["ts"] = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds(),
                            ["iso"] = DateTime.UtcNow.ToString("o"),
                            ["norm"] = Math.Round(norm, 4),
                            ["centerGain"] = Math.Round(centerGain, 4),
                            ["dampGain"] = Math.Round(dampGain, 4),
                            ["frictionGain"] = Math.Round(frictionGain, 4),
                            ["inertiaGain"] = Math.Round(inertiaGain, 4),
                            ["springSm"] = Math.Round(springSm, 2),
                            ["damper"] = Math.Round(damper, 2),
                            ["mechOut"] = mechOut,
                            ["gameMag"] = gameMag,
                            ["output"] = output,
                            ["centerPolarity"] = CenterPolarity,
                            ["forcePolarity"] = ForcePolarity,
                        });
                    }

                    Thread.Sleep(2);
                }
                catch (SocketException)
                {
                    Thread.Sleep(2);
                }
                catch (Exception ex)
                {
                    Console.Error.WriteLine("[ffb-host] loop: " + ex.Message);
                    Thread.Sleep(50);
                }
            }
            } // using udp/axisUdp
        }
        catch (Exception ex)
        {
            Console.Error.WriteLine("[ffb-host] fatal: " + ex);
        }
        finally
        {
            try
            {
                if (effect != null)
                {
                    var cf = new ConstantForce { Magnitude = 0 };
                    var p = new EffectParameters { Parameters = cf };
                    effect.SetParameters(p, EffectParameterFlags.TypeSpecificParameters);
                    effect.Stop();
                }
            }
            catch { }
            try { effect?.Dispose(); } catch { }
            try { device?.Unacquire(); } catch { }
            try { device?.Dispose(); } catch { }
            try { di?.Dispose(); } catch { }
            lock (EffectLogLock)
            {
                try { EffectLogWriter?.Flush(); } catch { }
                try { EffectLogWriter?.Dispose(); } catch { }
                EffectLogWriter = null;
            }
        }
    }

    static void ApplyMagnitude(
        IDirectInputEffect effect,
        EffectParameters effectParams,
        ConstantForce cf,
        int magnitude)
    {
        cf.Magnitude = magnitude;
        effectParams.Parameters = cf;
        effect.SetParameters(effectParams, EffectParameterFlags.TypeSpecificParameters);
    }

    static readonly object EffectLogLock = new();
    static StreamWriter? EffectLogWriter;
    static DateTime lastEffectLogFlush = DateTime.MinValue;

    static void AppendEffectLog(string path, Dictionary<string, object?> row)
    {
        try
        {
            var json = System.Text.Json.JsonSerializer.Serialize(row);
            lock (EffectLogLock)
            {
                if (EffectLogWriter == null)
                {
                    EffectLogWriter = new StreamWriter(
                        new FileStream(path, FileMode.Append, FileAccess.Write, FileShare.ReadWrite),
                        Encoding.UTF8)
                    {
                        AutoFlush = false,
                    };
                }
                EffectLogWriter.WriteLine(json);
                // Flush at most ~5 Hz — AppendAllText each sample stalled the FFB loop
                if ((DateTime.UtcNow - lastEffectLogFlush).TotalMilliseconds >= 200)
                {
                    EffectLogWriter.Flush();
                    lastEffectLogFlush = DateTime.UtcNow;
                }
            }
        }
        catch
        {
            /* optional */
        }
    }

    static double ReadWheelDegrees(IDirectInputDevice8 device, double halfLockDeg)
    {
        try { device.Poll(); } catch { try { device.Acquire(); } catch { } }
        var state = device.GetCurrentState<JoystickState, RawJoystickState, JoystickUpdate>();
        double norm = (state.X - 32767.5) / 32767.5;
        if (norm > 1) norm = 1;
        if (norm < -1) norm = -1;
        return norm * halfLockDeg;
    }

    static double ReadNorm(IDirectInputDevice8 device)
    {
        try { device.Poll(); } catch { try { device.Acquire(); } catch { } }
        var state = device.GetCurrentState<JoystickState, RawJoystickState, JoystickUpdate>();
        double norm = (state.X - 32767.5) / 32767.5;
        if (norm > 1) norm = 1;
        if (norm < -1) norm = -1;
        return norm;
    }

    /// <summary>
    /// Pick DI sign so spring −norm pulls toward center (measures |norm| drop).
    /// </summary>
    static void CalibrateCenterPolarity(
        IDirectInputDevice8 device,
        IDirectInputEffect effect,
        EffectParameters effectParams,
        ConstantForce cf)
    {
        ApplyMagnitude(effect, effectParams, cf, 0);
        Thread.Sleep(60);
        double n0 = ReadNorm(device);

        // Need a little offset to measure; nudge if near dead-center
        if (Math.Abs(n0) < 0.04)
        {
            ApplyMagnitude(effect, effectParams, cf, ForcePolarity * 700);
            Thread.Sleep(140);
            ApplyMagnitude(effect, effectParams, cf, 0);
            Thread.Sleep(80);
            n0 = ReadNorm(device);
        }

        // Correct relationship: spring cmd = p*(-norm) recenters when p == ForcePolarity.
        // (Old fallback used -ForcePolarity and walked the rim off to one side.)
        if (Math.Abs(n0) < 0.025)
        {
            CenterPolarity = ForcePolarity;
            Console.WriteLine("[ffb-host] center polarity fallback=" + CenterPolarity);
            return;
        }

        int best = ForcePolarity;
        double bestScore = double.NegativeInfinity;
        foreach (int p in new[] { ForcePolarity, -ForcePolarity })
        {
            double before = Math.Abs(ReadNorm(device));
            int side = Math.Sign(ReadNorm(device));
            if (side == 0) side = 1;
            // Command "toward center" in spring math: p * (-norm)
            int cmd = (int)Math.Round(p * (-side) * 1100.0);
            if (cmd > DiNominal) cmd = DiNominal;
            if (cmd < -DiNominal) cmd = -DiNominal;
            ApplyMagnitude(effect, effectParams, cf, cmd);
            Thread.Sleep(200);
            double after = Math.Abs(ReadNorm(device));
            ApplyMagnitude(effect, effectParams, cf, 0);
            Thread.Sleep(100);
            double score = before - after;
            Console.WriteLine($"[ffb-host] center probe p={p} Δ|n|={score:0.####} ({before:0.###}→{after:0.###})");
            if (score > bestScore)
            {
                bestScore = score;
                best = p;
            }
        }

        // Noise-level scores are unreliable — trust ForcePolarity
        CenterPolarity = bestScore >= 0.012 ? best : ForcePolarity;
        Console.WriteLine($"[ffb-host] center polarity={CenterPolarity} (score={bestScore:0.####})");
    }

    /// <summary>
    /// Startup proof: −25° left, +25° right, back to start.
    /// Relative to start angle, soft force, hard ±28° travel cap (never end-stop).
    /// </summary>
    static void RunStartupAngleDemo(
        IDirectInputDevice8 device,
        IDirectInputEffect effect,
        EffectParameters effectParams,
        ConstantForce cf)
    {
        const double halfLockDeg = 450; // 900° wheel: HID ±1 = ±450°
        const double travelDeg = 25;
        const double safetyDeg = 28;

        ApplyMagnitude(effect, effectParams, cf, 0);
        Thread.Sleep(40);
        double origin = ReadWheelDegrees(device, halfLockDeg);

        // Learn force polarity with a tiny nudge (must see movement)
        ApplyMagnitude(effect, effectParams, cf, 500);
        Thread.Sleep(160);
        double after = ReadWheelDegrees(device, halfLockDeg);
        ApplyMagnitude(effect, effectParams, cf, 0);
        Thread.Sleep(80);

        double probeDelta = after - origin;
        if (Math.Abs(probeDelta) < 0.4)
        {
            Console.WriteLine("[ffb-host] startup demo skipped — wheel angle not readable");
            CenterPolarity = ForcePolarity;
            return;
        }

        // polarity: +force raised angle → +1; else −1
        ForcePolarity = Math.Sign(probeDelta);
        if (ForcePolarity == 0) ForcePolarity = 1;
        Console.WriteLine($"[ffb-host] demo polarity={ForcePolarity} origin={origin:0.0}°");

        // Near end-stop the ±25° demo is useless and polarity is often wrong
        if (Math.Abs(origin) > 120)
        {
            Console.WriteLine("[ffb-host] wheel far from center — skip travel demo, calibrate spring only");
            CalibrateCenterPolarity(device, effect, effectParams, cf);
            return;
        }

        // Undo probe nudge back near origin first
        MoveRelativeToOrigin(device, effect, effectParams, cf, origin, 0, ForcePolarity, halfLockDeg, safetyDeg);

        MoveRelativeToOrigin(device, effect, effectParams, cf, origin, -travelDeg, ForcePolarity, halfLockDeg, safetyDeg);
        Thread.Sleep(180);
        MoveRelativeToOrigin(device, effect, effectParams, cf, origin, +travelDeg, ForcePolarity, halfLockDeg, safetyDeg);
        Thread.Sleep(180);
        MoveRelativeToOrigin(device, effect, effectParams, cf, origin, 0, ForcePolarity, halfLockDeg, safetyDeg);

        CalibrateCenterPolarity(device, effect, effectParams, cf);
        Console.WriteLine("[ffb-host] startup demo done (−25° / +25° / center)");
    }

    static void MoveRelativeToOrigin(
        IDirectInputDevice8 device,
        IDirectInputEffect effect,
        EffectParameters effectParams,
        ConstantForce cf,
        double originDeg,
        double offsetDeg,
        int polarity,
        double halfLockDeg,
        double safetyDeg)
    {
        double target = originDeg + offsetDeg;
        var deadline = DateTime.UtcNow.AddMilliseconds(1100);

        while (DateTime.UtcNow < deadline)
        {
            double cur = ReadWheelDegrees(device, halfLockDeg);

            // Never allow end-stop slam
            if (Math.Abs(cur - originDeg) > safetyDeg)
            {
                ApplyMagnitude(effect, effectParams, cf, 0);
                Console.WriteLine($"[ffb-host] demo safety stop at {cur - originDeg:0.0}°");
                break;
            }

            double err = target - cur;
            if (Math.Abs(err) <= 1.5)
                break;

            // Soft P, low cap — ~25° only
            double cmd = polarity * err * 55.0;
            if (cmd > 750) cmd = 750;
            if (cmd < -750) cmd = -750;
            if (Math.Abs(cmd) < 220)
                cmd = Math.Sign(cmd) * 220;

            ApplyMagnitude(effect, effectParams, cf, (int)Math.Round(cmd));
            Thread.Sleep(10);
        }

        ApplyMagnitude(effect, effectParams, cf, 0);
    }

    sealed class HiddenForm : Form
    {
        public HiddenForm()
        {
            FormBorderStyle = FormBorderStyle.FixedToolWindow;
            ShowInTaskbar = false;
            Size = new Size(1, 1);
            StartPosition = FormStartPosition.Manual;
            Location = new Point(-32000, -32000);
            Text = "GTAMOZA FFB Host";
        }
    }
}
