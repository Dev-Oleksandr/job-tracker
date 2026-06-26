package com.jobtracker.app;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(InstallerPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
