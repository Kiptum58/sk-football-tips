import { fixtures } from '../fixtures';
import { useState } from 'react';
import {
  View, Text, ScrollView, Pressable, TextInput, Alert
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const C = {
  bg: '#07111F',
  panel: '#101E30',
  panel2: '#15263B',
  green: '#27D17F',
  gold: '#F5C451',
  white: '#F4F7FB',
  muted: '#91A2B8'
};

type Tip = {
  id: number;
  league: string;
  home: string;
  away: string;
  market: string;
  pick: string;
  confidence: string;
  access: 'FREE' | 'PREMIUM';
  source: string;
  status: string;
};

const initialTips: Tip[] = [
  {
    id: 1, league: 'Premier League', home: 'Arsenal',
    away: 'Chelsea', market: 'Double chance',
    pick: 'Arsenal or Draw (1X)', confidence: '68%',
    access: 'FREE', source: 'AI', status: 'PENDING'
  },
  {
    id: 2, league: 'La Liga', home: 'Barcelona',
    away: 'Valencia', market: 'Total goals',
    pick: 'Over 1.5 goals', confidence: '74%',
    access: 'FREE', source: 'AI', status: 'PENDING'
  },
  {
    id: 3, league: 'Serie A', home: 'Inter',
    away: 'AC Milan', market: 'Both teams to score',
    pick: 'Yes', confidence: '61%',
    access: 'PREMIUM', source: 'EXPERT', status: 'PENDING'
  }
];

const leagues = [
  'All', 'Premier League', 'La Liga', 'Serie A',
  'Bundesliga', 'Champions League', 'Other'
];

function Label({ children, color = C.muted }: {
  children: any;
  color?: string;
}) {
  return (
    <Text style={{
      color, fontSize: 11, fontWeight: '800',
      letterSpacing: 1
    }}>
      {children}
    </Text>
  );
}

function Pill({ children, color = C.green }: {
  children: any;
  color?: string;
}) {
  return (
    <View style={{
      backgroundColor: color + '20',
      paddingHorizontal: 9,
      paddingVertical: 8,
      borderRadius: 20
    }}>
      <Text style={{
        color, fontSize: 10, fontWeight: '900'
      }}>
        {children}
      </Text>
    </View>
  );
}

const inputStyle = {
  backgroundColor: C.panel,
  color: C.white,
  padding: 14,
  borderRadius: 10,
  marginTop: 10,
  borderWidth: 1,
  borderColor: '#25405A'
} as const;

export default function Home() {
  const [tab, setTab] = useState('Home');
  const [filter, setFilter] = useState('All');
  const [tips, setTips] = useState<Tip[]>(initialTips);
  const [premium, setPremium] = useState(false);
  const [admin, setAdmin] = useState(false);
  const [home, setHome] = useState('');
  const [away, setAway] = useState('');
  const [pick, setPick] = useState('');
  const [market, setMarket] = useState('1X2');
  const [access, setAccess] = useState<'FREE' | 'PREMIUM'>('FREE');

  const addTip = () => {
    if (!home.trim() || !away.trim() || !pick.trim()) {
      Alert.alert(
        'Missing details',
        'Enter both teams and a prediction.'
      );
      return;
    }

    const newTip: Tip = {
      id: Date.now(),
      league: 'Other',
      home,
      away,
      market,
      pick,
      confidence: 'Not rated',
      access,
      source: 'EXPERT',
      status: 'PENDING'
    };

    setTips([newTip, ...tips]);
    setHome('');
    setAway('');
    setPick('');

    Alert.alert(
      'Prediction added',
      'Your manual prediction has been published in this demo.'
    );
  };

  const visibleTips = tips.filter(
    t => filter === 'All' || t.league === filter
  );

  const button = (name: string) => (
    <Pressable
      key={name}
      onPress={() => setTab(name)}
      style={{
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 58,
        paddingVertical: 12
      }}
    >
      <Text style={{
        color: tab === name ? C.green : C.muted,
        fontWeight: '800',
        fontSize: 11
      }}>
        {name}
      </Text>
    </Pressable>
  );

  return (
    <SafeAreaView style={{
      flex: 1,
      backgroundColor: C.bg
    }}>
      <View style={{
        paddingHorizontal: 20,
        paddingTop: 12,
        paddingBottom: 16,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <View>
          <Text style={{
            color: C.green,
            fontSize: 12,
            fontWeight: '900',
            letterSpacing: 2
          }}>
            SK SPORTS
          </Text>
          <Text style={{
            color: C.white,
            fontSize: 22,
            fontWeight: '900'
          }}>
            FOOTBALL TIPS
          </Text>
        </View>

        <Pill color={premium ? C.gold : C.green}>
          {premium ? 'PREMIUM MEMBER' : 'FREE MEMBER'}
        </Pill>
      </View>

      <ScrollView
        key={tab}
        contentContainerStyle={{
          paddingHorizontal: 18,
          paddingBottom: 28
        }}
      >
        {tab === 'Home' && (
          <>
            <View style={{
              backgroundColor: C.panel,
              borderRadius: 18,
              padding: 18,
              marginBottom: 18,
              borderWidth: 1,
              borderColor: '#1B3850'
            }}>
              <Label color={C.green}>MATCH INTELLIGENCE</Label>
              <Text style={{
                color: C.white,
                fontSize: 25,
                fontWeight: '900',
                marginTop: 8
              }}>
                Smarter football insights.
              </Text>
              <Text style={{
                color: C.muted,
                lineHeight: 21,
                marginTop: 7
              }}>
                AI-assisted analysis and expert selections
                across worldwide competitions.
              </Text>
              <View style={{
                flexDirection: 'row',
                gap: 8,
                marginTop: 16
              }}>
                <Pill>AI ANALYSIS</Pill>
                <Pill color={C.gold}>EXPERT TIPS</Pill>
              </View>
            </View>

            <View style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 12
            }}>
              <Text style={{
                color: C.white,
                fontSize: 18,
                fontWeight: '900'
              }}>
                Today's predictions
              </Text>
              <Label>{tips.length} TIPS</Label>
            </View>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={{ marginBottom: 14 }}
            >
              {leagues.map(l => (
                <Pressable
                  key={l}
                  onPress={() => setFilter(l)}
                  style={{
                    paddingHorizontal: 13,
                    paddingVertical: 9,
                    marginRight: 7,
                    borderRadius: 20,
                    backgroundColor:
                      filter === l ? C.green : C.panel
                  }}
                >
                  <Text style={{
                    color: filter === l ? C.bg : C.muted,
                    fontWeight: '800',
                    fontSize: 12
                  }}>
                    {l}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>

            {visibleTips.map(t => (
              <View
                key={t.id}
                style={{
                  backgroundColor: C.panel,
                  borderRadius: 16,
                  padding: 15,
                  marginBottom: 12,
                  borderWidth: 1,
                  borderColor: '#1A3048'
                }}
              >
                <View style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}>
                  <Label>{t.league.toUpperCase()}</Label>
                  <Pill color={
                    t.access === 'PREMIUM' ? C.gold : C.green
                  }>
                    {t.access}
                  </Pill>
                </View>

                <Text style={{
                  color: C.white,
                  fontSize: 17,
                  fontWeight: '900',
                  marginTop: 12
                }}>
                  {t.home}
                  <Text style={{
                    color: C.muted,
                    fontSize: 12
                  }}> VS </Text>
                  {t.away}
                </Text>

                <View style={{
                  backgroundColor: C.panel2,
                  borderRadius: 11,
                  padding: 12,
                  marginTop: 12
                }}>
                  <Label>
                    PREDICTION · {t.market.toUpperCase()}
                  </Label>
                  <Text style={{
                    color: C.green,
                    fontSize: 17,
                    fontWeight: '900',
                    marginTop: 5
                  }}>
                    {t.access === 'PREMIUM' && !premium
                      ? '🔒 Premium pick'
                      : t.pick}
                  </Text>
                </View>

                <View style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  marginTop: 12,
                  alignItems: 'center'
                }}>
                  <Pill color={
                    t.source === 'AI' ? '#6FB6FF' : C.gold
                  }>
                    {t.source === 'AI'
                      ? 'AI ANALYSIS'
                      : 'EXPERT PICK'}
                  </Pill>
                  <Text style={{
                    color: C.muted,
                    fontSize: 10
                  }}>
                    Confidence: {t.confidence}
                  </Text>
                </View>
              </View>
            ))}

            <Text style={{
              color: C.muted,
              fontSize: 11,
              lineHeight: 17,
              marginTop: 6
            }}>
              Predictions are estimates, not guarantees.
              Always check match information independently.
              Never stake money you cannot afford to lose.
            </Text>
          </>
        )}

        {tab === 'Fixtures' && (
          <>
            <Text style={{
              color: C.white,
              fontSize: 22,
              fontWeight: '900',
              marginBottom: 8
            }}>
              Fixtures & leagues
            </Text>
            <Text style={{
              color: C.muted,
              lineHeight: 21
            }}>
              The live fixtures feed will be connected to
              a verified football data provider in the
              next integration stage.
            </Text>

            {leagues.slice(1).map(l => (
              <View key={l} style={{
                backgroundColor: C.panel,
                padding: 16,
                borderRadius: 12,
                marginTop: 10
              }}>
                <Text style={{
                  color: C.white,
                  fontWeight: '800'
                }}>
                  {l}
                </Text>
                <Text style={{
                  color: C.muted,
                  fontSize: 12,
                  marginTop: 4
                }}>
                  Fixtures feed pending API connection
                </Text>
              </View>
            ))}
          </>
        )}

        {tab === 'Premium' && (
          <View style={{
            backgroundColor: C.panel,
            borderRadius: 18,
            padding: 20
          }}>
            <Pill color={C.gold}>MEMBERSHIP</Pill>
            <Text style={{
              color: C.white,
              fontSize: 25,
              fontWeight: '900',
              marginTop: 12
            }}>
              Unlock premium tips
            </Text>
            <Text style={{
              color: C.muted,
              lineHeight: 22,
              marginTop: 8
            }}>
              Access selected expert predictions, deeper
              match analysis and premium history.
            </Text>
            <Pressable
              onPress={() => Alert.alert(
                'Payment integration pending',
                'Subscription payments will be connected after the backend and Play Store billing setup.'
              )}
              style={{
                backgroundColor: C.green,
                padding: 15,
                borderRadius: 12,
                marginTop: 20,
                alignItems: 'center'
              }}
            >
              <Text style={{
                color: C.bg,
                fontWeight: '900'
              }}>
                VIEW SUBSCRIPTION OPTIONS
              </Text>
            </Pressable>
            <Text style={{
              color: C.muted,
              fontSize: 11,
              marginTop: 12
            }}>
              This demo does not collect payments or
              activate subscriptions.
            </Text>
          </View>
        )}

        {tab === 'Admin' && (
          <View>
            <Text style={{
              color: C.white,
              fontSize: 22,
              fontWeight: '900'
            }}>
              Admin workspace
            </Text>
            <Text style={{
              color: C.muted,
              lineHeight: 20,
              marginTop: 6
            }}>
              Prototype only: secure administrator sign-in
              and server-side permissions must be added
              before public release.
            </Text>

            <Pressable
              onPress={() => setAdmin(!admin)}
              style={{
                backgroundColor: C.panel2,
                padding: 18,
                borderRadius: 10,
                marginTop: 12
              }}
            >
              <Text style={{
                color: C.green,
                fontWeight: '900'
              }}>
                {admin
                  ? 'Hide manual publisher'
                  : 'Open manual publisher'}
              </Text>
            </Pressable>

            {admin && (
              <>
                <TextInput
                  value={home}
                  onChangeText={setHome}
                  placeholder="Home team"
                  placeholderTextColor={C.muted}
                  style={inputStyle}
                />
                <TextInput
                  value={away}
                  onChangeText={setAway}
                  placeholder="Away team"
                  placeholderTextColor={C.muted}
                  style={inputStyle}
                />
                <TextInput
                  value={market}
                  onChangeText={setMarket}
                  placeholder="Market e.g. 1X2, Over 2.5"
                  placeholderTextColor={C.muted}
                  style={inputStyle}
                />
                <TextInput
                  value={pick}
                  onChangeText={setPick}
                  placeholder="Your prediction"
                  placeholderTextColor={C.muted}
                  style={inputStyle}
                />

                <View style={{
                  flexDirection: 'row',
                  gap: 8,
                  marginTop: 8
                }}>
                  {(['FREE', 'PREMIUM'] as const).map(a => (
                    <Pressable
                      key={a}
                      onPress={() => setAccess(a)}
                      style={{
                        padding: 11,
                        borderRadius: 9,
                        backgroundColor:
                          access === a ? C.green : C.panel2
                      }}
                    >
                      <Text style={{
                        color: access === a ? C.bg : C.white,
                        fontWeight: '900'
                      }}>
                        {a}
                      </Text>
                    </Pressable>
                  ))}
                </View>

                <Pressable
                  onPress={addTip}
                  style={{
                    backgroundColor: C.green,
                    padding: 15,
                    borderRadius: 11,
                    alignItems: 'center',
                    marginTop: 14
                  }}
                >
                  <Text style={{
                    color: C.bg,
                    fontWeight: '900'
                  }}>
                    PUBLISH DEMO PREDICTION
                  </Text>
                </Pressable>
              </>
            )}
          </View>
        )}

        {tab === 'Profile' && (
          <View style={{
            backgroundColor: C.panel,
            padding: 18,
            borderRadius: 16
          }}>
            <Text style={{
              color: C.white,
              fontSize: 22,
              fontWeight: '900'
            }}>
              Your account
            </Text>
            <Text style={{
              color: C.muted,
              marginTop: 8
            }}>
              Sign-up, login, saved tips and account settings
              will be connected to the secure backend.
            </Text>

            <Pressable
              onPress={() => setPremium(!premium)}
              style={{
                backgroundColor: C.panel2,
                padding: 14,
                borderRadius: 10,
                marginTop: 16
              }}
            >
              <Text style={{
                color: C.green,
                fontWeight: '900'
              }}>
                DEMO: {premium
                  ? 'Switch to free preview'
                  : 'Preview premium access'}
              </Text>
            </Pressable>

            <Text style={{
              color: C.muted,
              fontSize: 11,
              marginTop: 12
            }}>
              Demo toggle only. It does not grant paid access.
            </Text>
          </View>
        )}
      </ScrollView>

      <View style={{
        flexDirection: 'row',
        borderTopWidth: 1,
        borderTopColor: '#1B3045',
        backgroundColor: C.bg
      }}>
        {['Home', 'Fixtures', 'Premium', 'Admin', 'Profile'].map(button)}
      </View>
    </SafeAreaView>
  );
}
