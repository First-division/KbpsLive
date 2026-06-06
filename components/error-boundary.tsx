import React from 'react';
import { View, Text, ScrollView, SafeAreaView } from 'react-native';

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('=== CRASH LOG ===');
    console.error('Error:', error.message);
    console.error('Stack:', error.stack);
    console.error('Info:', info.componentStack);
    console.error('=== END CRASH LOG ===');
  }

  render() {
    if (this.state.hasError) {
      return (
        <SafeAreaView style={{ flex: 1, backgroundColor: '#f00' }}>
          <ScrollView style={{ flex: 1, padding: 20 }}>
            <Text style={{ fontSize: 20, fontWeight: 'bold', color: '#fff', marginBottom: 10 }}>
              ⚠️ CRASH
            </Text>
            <Text style={{ fontSize: 14, color: '#fff', marginBottom: 10, fontFamily: 'Courier' }}>
              {this.state.error?.message}
            </Text>
            <Text style={{ fontSize: 12, color: '#ddd', fontFamily: 'Courier' }}>
              {this.state.error?.stack}
            </Text>
          </ScrollView>
        </SafeAreaView>
      );
    }

    return this.props.children;
  }
}
