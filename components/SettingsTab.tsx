import { ArrowLeft, Send } from 'lucide-react';
import { type ChangeEvent, type KeyboardEvent, type ReactNode, useMemo } from 'react';
import { GoToLinksSettings } from '@/components/GoToLinksSettings';
import type { useGoToLinks } from '@/hooks/useGoToLinks';
import { useLocale } from '@/hooks/useLocale';
import type { useReloadAfterUpload } from '@/hooks/useReloadAfterUpload';
import type { useSplitViewButton } from '@/hooks/useSplitViewButton';
import type { useStrokeColor } from '@/hooks/useStrokeColor';
import type { ThemeMode } from '@/hooks/useTheme';
import type { TranslateFn } from '@/lib/i18n';
import { LOCALE_OPTIONS, type Locale } from '@/lib/i18n/locale';
import { RELEASES_URL } from '@/lib/releases_url';
import { DEFAULT_STROKE_COLOR_INPUT, toStrokeColorInputValue } from '@/lib/stroke_color';
import packageJson from '../package.json';

const SETTINGS_BACK_ICON_SIZE = 18;
const SETTINGS_FOOTER_ICON_SIZE = 16;

type StrokeColorSettings = Pick<
  ReturnType<typeof useStrokeColor>,
  | 'inputValue'
  | 'effectiveColor'
  | 'validationError'
  | 'applyStatus'
  | 'isLoaded'
  | 'isApplying'
  | 'canApply'
  | 'handleInputChange'
  | 'handleApply'
>;

type ReloadAfterUploadSettings = Pick<
  ReturnType<typeof useReloadAfterUpload>,
  'isEnabled' | 'isLoaded' | 'setIsEnabled' | 'canChange'
>;

type GoToLinksSettingsState = Pick<
  ReturnType<typeof useGoToLinks>,
  | 'isMenuEnabled'
  | 'items'
  | 'isLoaded'
  | 'setIsMenuEnabled'
  | 'setItemActive'
  | 'moveItemUp'
  | 'moveItemDown'
>;

type SplitViewButtonSettings = Pick<
  ReturnType<typeof useSplitViewButton>,
  'isEnabled' | 'isLoaded' | 'setIsEnabled'
>;

type SettingsTabProps = {
  themeMode: ThemeMode;
  onThemeModeChange: (mode: ThemeMode) => void;
  onBack: () => void;
  strokeColor: StrokeColorSettings;
  reloadAfterUpload: ReloadAfterUploadSettings;
  splitViewButton: SplitViewButtonSettings;
  goToLinks: GoToLinksSettingsState;
};

type SettingsTabRuntime = {
  setLocale: (locale: Locale) => void;
  onThemeModeChange: (mode: ThemeMode) => void;
  setSplitViewButtonEnabled: (enabled: boolean) => void;
  setReloadAfterUploadEnabled: (enabled: boolean) => void;
  handleApply: () => Promise<void>;
  handleInputChange: (value: string) => void;
  canApply: boolean;
};

const settingsTabRuntime: { current: SettingsTabRuntime | null } = { current: null };

function logStrokeColorApplyFailure(error: unknown): void {
  console.warn('[nmap_uploader] stroke color apply failed:', error);
}

function handleStrokeColorApplyTask(task: Promise<void>): void {
  task.catch(logStrokeColorApplyFailure);
}

function getColorInputGroupClassName(hasValidationError: boolean): string {
  let className = 'settings-color-input-group';
  if (hasValidationError) {
    className = 'settings-color-input-group settings-color-input-group--invalid';
  }
  return className;
}

function getApplyButtonText(isApplying: boolean, applyLabel: string): string {
  let text: string;
  if (isApplying) {
    text = '…';
  } else {
    text = applyLabel;
  }
  return text;
}

function getStrokeColorAriaInvalid(hasValidationError: boolean): true | undefined {
  let result: true | undefined;
  if (hasValidationError) {
    result = true;
  }
  return result;
}

function buildThemeModeOptions(t: TranslateFn) {
  const darkLabel = t('settings.themeDark');
  const lightLabel = t('settings.themeLight');
  const systemLabel = t('settings.themeSystem');
  return [
    { value: 'dark' as const, label: darkLabel },
    { value: 'light' as const, label: lightLabel },
    { value: 'system' as const, label: systemLabel },
  ] as const;
}

function themeModeOptionsMemo(t: TranslateFn) {
  return buildThemeModeOptions(t);
}

type ThemeModeOption = {
  value: ThemeMode;
  label: string;
};

type LocaleOptionRenderContext = {
  locale: Locale;
  translate: TranslateFn;
};

type ThemeModeOptionRenderContext = {
  themeMode: ThemeMode;
};

function getSplitViewButtonDisabled(isLoaded: boolean): boolean {
  return !isLoaded;
}

function getReloadAfterUploadDisabled(isLoaded: boolean, canChange: boolean): boolean {
  return !isLoaded || !canChange;
}

function getStrokeColorDisabled(isLoaded: boolean, isApplying: boolean): boolean {
  return !isLoaded || isApplying;
}

function getApplyDisabled(canApply: boolean): boolean {
  return !canApply;
}

function buildLocaleOptionItems(context: LocaleOptionRenderContext): ReactNode[] {
  const items: ReactNode[] = [];
  for (let index = 0; index < LOCALE_OPTIONS.length; index += 1) {
    const option = LOCALE_OPTIONS[index];
    const localeOptionItem = (
      <label key={option.value} className="theme-mode-switch-option">
        <input
          type="radio"
          name="locale"
          value={option.value}
          className="theme-mode-switch-input"
          checked={context.locale === option.value}
          onChange={onLocaleChange}
        />
        <span className="theme-mode-switch-label">{context.translate(option.labelKey)}</span>
      </label>
    );
    items.push(localeOptionItem);
  }
  return items;
}

function buildThemeModeOptionItems(
  options: readonly ThemeModeOption[],
  context: ThemeModeOptionRenderContext,
): ReactNode[] {
  const items: ReactNode[] = [];
  for (let index = 0; index < options.length; index += 1) {
    const option = options[index];
    const themeModeOptionItem = (
      <label key={option.value} className="theme-mode-switch-option">
        <input
          type="radio"
          name="theme-mode"
          value={option.value}
          className="theme-mode-switch-input"
          checked={context.themeMode === option.value}
          onChange={onThemeModeRadioChange}
        />
        <span className="theme-mode-switch-label">{option.label}</span>
      </label>
    );
    items.push(themeModeOptionItem);
  }
  return items;
}

function renderStrokeColorValidationError(message: string | null): ReactNode {
  let content: ReactNode = null;
  if (message) {
    content = (
      <p id="stroke-color-error" className="settings-field-error" role="alert">
        {message}
      </p>
    );
  }
  return content;
}

function renderStrokeColorApplySuccess(isSuccess: boolean, successMessage: string): ReactNode {
  let content: ReactNode = null;
  if (isSuccess) {
    content = (
      <p className="settings-field-success" role="status">
        {successMessage}
      </p>
    );
  }
  return content;
}

function renderStrokeColorApplyError(isError: boolean, errorMessage: string): ReactNode {
  let content: ReactNode = null;
  if (isError) {
    content = (
      <p className="settings-field-error" role="alert">
        {errorMessage}
      </p>
    );
  }
  return content;
}

function onApplyClick(): void {
  const runtime = settingsTabRuntime.current;
  if (runtime) {
    const applyTask = runtime.handleApply();
    handleStrokeColorApplyTask(applyTask);
  }
}

function onColorPickerChange(value: string): void {
  const handleInputChange = settingsTabRuntime.current?.handleInputChange;
  if (handleInputChange) {
    const normalizedValue = toStrokeColorInputValue(value);
    handleInputChange(normalizedValue);
  }
}

function onColorPickerInputChange(event: ChangeEvent<HTMLInputElement>): void {
  onColorPickerChange(event.target.value);
}

function onStrokeColorInputChange(event: ChangeEvent<HTMLInputElement>): void {
  onColorPickerChange(event.target.value);
}

function onStrokeColorInputKeyDown(event: KeyboardEvent<HTMLInputElement>): void {
  const runtime = settingsTabRuntime.current;
  if (runtime && event.key === 'Enter') {
    event.preventDefault();
    if (runtime.canApply) {
      onApplyClick();
    }
  }
}

function onLocaleChange(event: ChangeEvent<HTMLInputElement>): void {
  settingsTabRuntime.current?.setLocale(event.target.value as Locale);
}

function onThemeModeRadioChange(event: ChangeEvent<HTMLInputElement>): void {
  settingsTabRuntime.current?.onThemeModeChange(event.target.value as ThemeMode);
}

function onSplitViewButtonChange(event: ChangeEvent<HTMLInputElement>): void {
  settingsTabRuntime.current?.setSplitViewButtonEnabled(event.target.checked);
}

function onReloadAfterUploadChange(event: ChangeEvent<HTMLInputElement>): void {
  settingsTabRuntime.current?.setReloadAfterUploadEnabled(event.target.checked);
}

export const SettingsTab = function settingsTab({
  themeMode,
  onThemeModeChange,
  onBack,
  strokeColor,
  reloadAfterUpload,
  splitViewButton,
  goToLinks,
}: SettingsTabProps) {
  const { locale, setLocale, t } = useLocale();
  const {
    inputValue,
    effectiveColor,
    validationError,
    applyStatus,
    isLoaded,
    isApplying,
    canApply,
    handleInputChange,
    handleApply,
  } = strokeColor;
  const {
    isEnabled: isReloadAfterUploadEnabled,
    isLoaded: isReloadAfterUploadLoaded,
    setIsEnabled: setReloadAfterUploadEnabled,
    canChange: canChangeReloadAfterUpload,
  } = reloadAfterUpload;
  const {
    isEnabled: isSplitViewButtonEnabled,
    isLoaded: isSplitViewButtonLoaded,
    setIsEnabled: setSplitViewButtonEnabled,
  } = splitViewButton;

  settingsTabRuntime.current = {
    setLocale,
    onThemeModeChange,
    setSplitViewButtonEnabled,
    setReloadAfterUploadEnabled,
    handleApply,
    handleInputChange,
    canApply,
  };

  const themeModeOptions = useMemo(
    function selectThemeModeOptions() {
      return themeModeOptionsMemo(t);
    },
    [t],
  );

  const isSplitViewButtonDisabled = getSplitViewButtonDisabled(isSplitViewButtonLoaded);
  const isReloadAfterUploadDisabled = getReloadAfterUploadDisabled(
    isReloadAfterUploadLoaded,
    canChangeReloadAfterUpload,
  );
  const isStrokeColorDisabled = getStrokeColorDisabled(isLoaded, isApplying);
  const isApplyDisabled = getApplyDisabled(canApply);
  const hasValidationError = Boolean(validationError);
  const colorInputGroupClassName = getColorInputGroupClassName(hasValidationError);
  const applyLabel = t('common.apply');
  const applyButtonText = getApplyButtonText(isApplying, applyLabel);
  const strokeColorAriaInvalid = getStrokeColorAriaInvalid(hasValidationError);
  const strokeColorValidationMessage = renderStrokeColorValidationError(validationError);
  const strokeColorAppliedLabel = t('settings.strokeColorApplied');
  const strokeColorSuccessMessage = renderStrokeColorApplySuccess(
    applyStatus === 'success',
    strokeColorAppliedLabel,
  );
  const strokeColorApplyErrorLabel = t('settings.strokeColorApplyError');
  const strokeColorErrorMessage = renderStrokeColorApplyError(
    applyStatus === 'error',
    strokeColorApplyErrorLabel,
  );
  const localeOptionItems = buildLocaleOptionItems({ locale, translate: t });
  const themeModeOptionItems = buildThemeModeOptionItems(themeModeOptions, { themeMode });

  return (
    <div className="tab-panel settings-tab">
      <button
        type="button"
        className="settings-back-btn"
        onClick={onBack}
        aria-label={t('tabs.backToUploadAria')}
      >
        <ArrowLeft size={SETTINGS_BACK_ICON_SIZE} aria-hidden />
        <span>{t('common.back')}</span>
      </button>

      <h2 className="settings-title">{t('settings.title')}</h2>

      <section className="settings-section" aria-labelledby="settings-language-heading">
        <h3 id="settings-language-heading" className="settings-section-title">
          {t('locale.label')}
        </h3>
        <div
          className="theme-mode-switch"
          role="radiogroup"
          aria-label={t('settings.languageAria')}
        >
          {localeOptionItems}
        </div>
      </section>

      <section className="settings-section" aria-labelledby="settings-appearance-heading">
        <h3 id="settings-appearance-heading" className="settings-section-title">
          {t('settings.appearance')}
        </h3>
        <div className="theme-mode-switch" role="radiogroup" aria-label={t('settings.themeAria')}>
          {themeModeOptionItems}
        </div>
      </section>

      <section className="settings-section" aria-labelledby="settings-split-view-heading">
        <div className="settings-toggle-row">
          <h3 id="settings-split-view-heading" className="settings-section-title">
            {t('settings.splitViewButton')}
          </h3>
          <label className="settings-toggle" htmlFor="settings-split-view-button">
            <input
              id="settings-split-view-button"
              type="checkbox"
              role="switch"
              className="settings-toggle-input"
              checked={isSplitViewButtonEnabled}
              aria-checked={isSplitViewButtonEnabled}
              disabled={isSplitViewButtonDisabled}
              aria-label={t('settings.splitViewAria')}
              onChange={onSplitViewButtonChange}
            />
            <span className="settings-toggle-track" aria-hidden="true">
              <span className="settings-toggle-thumb" />
            </span>
          </label>
        </div>
      </section>

      <GoToLinksSettings {...goToLinks} />

      <section className="settings-section" aria-labelledby="settings-upload-heading">
        <div className="settings-toggle-row">
          <h3 id="settings-upload-heading" className="settings-section-title">
            {t('settings.reloadAfterUpload')}
          </h3>
          <label className="settings-toggle" htmlFor="settings-reload-after-upload">
            <input
              id="settings-reload-after-upload"
              type="checkbox"
              role="switch"
              className="settings-toggle-input"
              checked={isReloadAfterUploadEnabled}
              aria-checked={isReloadAfterUploadEnabled}
              disabled={isReloadAfterUploadDisabled}
              aria-label={t('settings.reloadAfterUploadAria')}
              onChange={onReloadAfterUploadChange}
            />
            <span className="settings-toggle-track" aria-hidden="true">
              <span className="settings-toggle-thumb" />
            </span>
          </label>
        </div>
      </section>

      <section className="settings-section" aria-labelledby="settings-path-heading">
        <h3 id="settings-path-heading" className="settings-section-title">
          {t('settings.strokeColor')}
        </h3>
        <div className="settings-field">
          <div className="settings-color-field">
            <input
              type="color"
              className="settings-color-picker"
              value={effectiveColor}
              disabled={isStrokeColorDisabled}
              aria-label={t('settings.pickStrokeColorAria')}
              onChange={onColorPickerInputChange}
            />
            <div className={colorInputGroupClassName}>
              <span className="settings-color-prefix" aria-hidden>
                #
              </span>
              <input
                id="stroke-color-input"
                type="text"
                className="settings-color-input"
                value={inputValue}
                placeholder={DEFAULT_STROKE_COLOR_INPUT}
                disabled={isStrokeColorDisabled}
                aria-label={t('settings.strokeColor')}
                aria-invalid={strokeColorAriaInvalid}
                aria-describedby="stroke-color-hint stroke-color-error"
                onChange={onStrokeColorInputChange}
                onKeyDown={onStrokeColorInputKeyDown}
              />
            </div>
            <button
              type="button"
              className="submit-btn--outline settings-apply-btn"
              disabled={isApplyDisabled}
              onClick={onApplyClick}
            >
              {applyButtonText}
            </button>
          </div>

          {strokeColorValidationMessage}
          {strokeColorSuccessMessage}
          {strokeColorErrorMessage}
        </div>
      </section>

      <section
        className="settings-section settings-section--about"
        aria-labelledby="settings-about-heading"
      >
        <h3 className="settings-section-title settings-section-title--row">
          <a
            id="settings-about-heading"
            href={RELEASES_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="settings-about-link"
          >
            {t('common.version')} {packageJson.version}
          </a>
          <div className="footer-links">
            <a
              href="https://t.me/notebook_loader_bot"
              target="_blank"
              rel="noopener noreferrer"
              className="footer-link"
            >
              <Send size={SETTINGS_FOOTER_ICON_SIZE} aria-hidden />
              @feedback
            </a>
          </div>
        </h3>
      </section>
    </div>
  );
};
