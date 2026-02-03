'use client';

import { themeParams, useSignal, useLaunchParams } from '@tma.js/sdk-react';
import { List } from '@telegram-apps/telegram-ui';
import { useMemo } from 'react';

import { DisplayData } from '@/components/DisplayData/DisplayData';
import { Page } from '@/components/Page';

export default function ThemeParamsPage() {
  const tp = useSignal(themeParams.state);
  const lp = useLaunchParams();

  // Fallback to launch params if themeParams.state is empty
  const themeParamsData = useMemo(() => {
    const state = tp || {};
    const hasState = Object.keys(state).length > 0;
    
    if (hasState) {
      return state;
    }
    
    // Fallback to launch params theme params
    return lp.tgWebAppThemeParams || {};
  }, [tp, lp.tgWebAppThemeParams]);

  const rows = useMemo(() => {
    return Object.entries(themeParamsData).map(([title, value]) => ({
      title: title
        .replace(/[A-Z]/g, (m) => `_${m.toLowerCase()}`)
        .replace(/background/, 'bg'),
      value,
    }));
  }, [themeParamsData]);

  if (rows.length === 0) {
    return (
      <Page>
        <List>
          <DisplayData
            rows={[{ title: 'No theme parameters available', value: 'Theme parameters are not available in the current environment' }]}
          />
        </List>
      </Page>
    );
  }

  return (
    <Page>
      <List>
        <DisplayData rows={rows} />
      </List>
    </Page>
  );
}
