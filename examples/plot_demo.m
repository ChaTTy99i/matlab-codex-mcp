%% Synthetic plotting example: no external input files or measured data
% Run in MATLAB. Figures remain open in a desktop session.
time = linspace(0,10,1001);
decayRate = 0.3;
frequencyHz = 0.8;
signal = exp(-decayRate*time).*cos(2*pi*frequencyHz*time);
envelope = exp(-decayRate*time);

assert(all(isfinite(signal)),'Signal contains nonfinite values.');
assert(abs(signal(1)-1) < 1e-12,'Initial value must be one.');
assert(all(abs(signal) <= envelope+1e-12),'Signal exceeds its envelope.');

fig = figure('Name','Synthetic damped oscillation');
if ~isMATLABReleaseOlderThan('R2025a'), theme(fig,'light'); end
plot(time,signal,'LineWidth',1.8);
hold on;
plot(time,envelope,'--',time,-envelope,'--','LineWidth',1.2);
grid on;
xlabel('Time (s)'); ylabel('Amplitude (arbitrary units)');
title('Synthetic damped oscillation');
legend('Signal','Upper envelope','Lower envelope','Location','best');
drawnow;
disp('PLOT_DEMO_OK: synthetic signal checks passed.');
