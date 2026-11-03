package com.furknsss.nevofocus;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(NativeFocusPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
