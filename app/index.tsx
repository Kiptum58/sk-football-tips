import * as Linking from 'expo-linking';
import { supabase } from '../lib/supabase';
import { fixtures } from '../fixtures';
import { useEffect, useState } from 'react';
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
  const [liveFixtures, setLiveFixtures] = useState(fixtures);
  const [predictions, setPredictions] = useState<any[]>([]);
  const [refreshingPredictions, setRefreshingPredictions] = useState(false);
  const [predictionSearch, setPredictionSearch] = useState('');
  const [predictionMarket, setPredictionMarket] = useState('All');
  const [tips, setTips] = useState<Tip[]>(initialTips);
  const [savedTips, setSavedTips] = useState<any[]>([]);
  const [expandedSavedTip, setExpandedSavedTip] = useState<string | null>(null);
  const [premium, setPremium] = useState(false);
  const [admin, setAdmin] = useState(false);
  const [home, setHome] = useState('');
  const [away, setAway] = useState('');
  const [pick, setPick] = useState('');
  const [market, setMarket] = useState('1X2');
  const [access, setAccess] = useState<'FREE' | 'PREMIUM'>('FREE');
  const [session, setSession] = useState<any>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');


  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (mounted) {
        setSession(session);
        setAuthLoading(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session);
        setAuthLoading(false);
      }
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    let isMounted = true;

    const loadFixtures = async () => {
      try {
        const response = await fetch('http://127.0.0.1:3000/fixtures');

        if (!response.ok) {
          throw new Error('Backend request failed');
        }

        const data = await response.json();

        if (isMounted && Array.isArray(data.fixtures) && data.fixtures.length > 0) {
          setLiveFixtures(data.fixtures);
        }
      } catch (error) {
        console.warn('Using saved fixtures because backend is unavailable.', error);
      }
    };

    loadFixtures();

    const refreshInterval = setInterval(loadFixtures, 10 * 60 * 1000);

    return () => {
      isMounted = false;
      clearInterval(refreshInterval);
    };
  }, []);

  useEffect(() => {
    let isMounted = true;

    const loadPredictions = async () => {
      try {
        const response = await fetch('http://127.0.0.1:3000/predictions');

        if (!response.ok) {
          throw new Error('Prediction request failed');
        }

        const data = await response.json();

        if (isMounted && Array.isArray(data.predictions)) {
          setPredictions(data.predictions);
        }
      } catch (error) {
        console.warn('Could not load AI predictions.', error);
      }
    };

    loadPredictions();
    const refreshInterval = setInterval(loadPredictions, 10 * 60 * 1000);

    return () => {
      isMounted = false;
      clearInterval(refreshInterval);
    };
  }, []);

  useEffect(() => {
    if (!session?.user?.id) {
      setSavedTips([]);
      return;
    }

    let active = true;

    const loadSavedTips = async () => {
      const { data, error } = await supabase
        .from("saved_tips")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) {
        Alert.alert("Saved tips", error.message);
        return;
      }

      if (active) {
        setSavedTips(data || []);
      }
    };

    loadSavedTips();

    return () => {
      active = false;
    };
  }, [session?.user?.id]);

  const refreshPredictions = async () => {
    setRefreshingPredictions(true);

    try {
      const response = await fetch('http://127.0.0.1:3000/predictions');

      if (!response.ok) {
        throw new Error('Prediction request failed');
      }

      const data = await response.json();

      if (!Array.isArray(data.predictions)) {
        throw new Error('Invalid prediction data received');
      }

      setPredictions(data.predictions);
      Alert.alert('Updated', 'Predictions have been refreshed successfully.');
    } catch (error) {
      console.warn('Could not refresh AI predictions.', error);
      Alert.alert('Refresh failed', 'Could not load predictions. Check that the backend is running.');
    } finally {
      setRefreshingPredictions(false);
    }
  };

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

  const handleAuth = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert('Missing details', 'Enter your email and password.');
      return;
    }

    if (authMode === 'signup' && !fullName.trim()) {
      Alert.alert('Missing name', 'Enter your full name.');
      return;
    }

    if (password.length < 6) {
      Alert.alert('Password too short', 'Use at least 6 characters.');
      return;
    }

    try {
      setAuthLoading(true);

      if (authMode === 'signup') {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            emailRedirectTo: Linking.createURL("auth/callback"),
            data: { full_name: fullName.trim() }
          }
        });

        if (error) throw error;

        if (!data.session) {
          Alert.alert('Registration received', 'Check your email for a confirmation link before logging in.');
        } else {
          Alert.alert('Welcome', 'Your account has been created.');
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password
        });

        if (error) throw error;
      }
    } catch (error: any) {
      Alert.alert('Authentication failed', error.message || 'Please try again.');
    } finally {
      setAuthLoading(false);
    }
  };

  const savePrediction = async (prediction: any) => {
    if (!session?.user?.id) {
      Alert.alert("Sign in required", "Please sign in to save tips.");
      setTab("Profile");
      return;
    }

    const alreadySaved = savedTips.some(
      item => item.tip_data?.id === prediction.id
    );

    if (alreadySaved) {
      Alert.alert("Already saved", "This prediction is already in your saved tips.");
      return;
    }

    const { data, error } = await supabase
      .from("saved_tips")
      .insert({
        user_id: session.user.id,
        tip_data: prediction
      })
      .select()
      .single();

    if (error) {
      Alert.alert("Save failed", error.message);
      return;
    }

    setSavedTips(current => [data, ...current]);
    Alert.alert("Saved", "Prediction added to your saved tips.");
  };

  
  const deleteSavedTip = async (id: string) => {
    const { error } = await supabase
      .from("saved_tips")
      .delete()
      .eq("id", id);

    if (error) {
      Alert.alert("Delete failed", error.message);
      return;
    }

    setSavedTips(current => current.filter(item => item.id !== id));
    setExpandedSavedTip(null);
    Alert.alert("Deleted", "Saved tip removed successfully.");
  };

  const handleSignOut = async () => {
    const { error } = await supabase.auth.signOut();

    if (error) {
      Alert.alert('Sign out failed', error.message);
    } else {
      setPassword('');
      Alert.alert('Signed out', 'You have been signed out.');
    }
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
              backgroundColor: C.panel,
              borderRadius: 16,
              padding: 15,
              marginBottom: 20,
              borderWidth: 1,
              borderColor: '#1B3850'
            }}>
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
                  SK AI Predictions
                </Text>
                <Pill>{predictions.length} MATCHES</Pill>
              </View>

              <Text style={{
                color: C.muted,
                fontSize: 11,
                marginBottom: 12
              }}>
                Statistical estimates from the SK Poisson goals model.
              </Text>

              {predictions.length === 0 ? (
                <Text style={{ color: C.gold, paddingVertical: 12 }}>
                  Loading predictions from the backend...
                </Text>
              ) : predictions.filter(p => {
              const query = predictionSearch.trim().toLowerCase();
              return `${p.home} ${p.away}`.toLowerCase().includes(query);
            }).map(p => (
                <View key={p.id} style={{
                  backgroundColor: C.panel2,
                  borderRadius: 12,
                  padding: 13,
                  marginBottom: 10
                }}>
                  <Text style={{
                    color: C.white,
                    fontSize: 15,
                    fontWeight: '900'
                  }}>
                    {p.home} vs {p.away}
                  </Text>

                  <Text style={{
                    color: C.muted,
                    fontSize: 10,
                    marginTop: 5
                  }}>
                    {new Date(p.kickoff).toLocaleString('en-KE', {
                      timeZone: 'Africa/Nairobi',
                      dateStyle: 'medium',
                      timeStyle: 'short'
                    })} EAT
                  </Text>

                  <View style={{
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    marginTop: 13
                  }}>
                    <View>
                      <Label>HOME</Label>
                      <Text style={{ color: C.green, fontWeight: '900', fontSize: 16 }}>
                        {p.markets['1X2'].home.toFixed(1)}%
                      </Text>
                    </View>
                    <View>
                      <Label>DRAW</Label>
                      <Text style={{ color: C.gold, fontWeight: '900', fontSize: 16 }}>
                        {p.markets['1X2'].draw.toFixed(1)}%
                      </Text>
                    </View>
                    <View>
                      <Label>AWAY</Label>
                      <Text style={{ color: C.green, fontWeight: '900', fontSize: 16 }}>
                        {p.markets['1X2'].away.toFixed(1)}%
                      </Text>
                    </View>
                  </View>

                  <Text style={{
                    color: C.muted,
                    fontSize: 11,
                    marginTop: 12
                  }}>
                    Expected goals: {p.expectedGoals.home.toFixed(2)} - {p.expectedGoals.away.toFixed(2)}
                  </Text>
                  <View style={{
                    marginTop: 14,
                    paddingTop: 12,
                    borderTopWidth: 1,
                    borderTopColor: C.muted
                  }}>
                    <Text style={{ color: C.gold, fontSize: 12, fontWeight: '900', marginBottom: 10 }}>
                      OVER / UNDER 2.5 GOALS
                    </Text>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                      <Text style={{ color: C.white, fontSize: 12 }}>
                        Over 2.5: {p.markets['Over/Under 2.5'].over.toFixed(1)}%
                      </Text>
                      <Text style={{ color: C.white, fontSize: 12 }}>
                        Under 2.5: {p.markets['Over/Under 2.5'].under.toFixed(1)}%
                      </Text>
                    </View>

                    <Text style={{ color: C.gold, fontSize: 12, fontWeight: '900', marginTop: 13, marginBottom: 10 }}>
                      BOTH TEAMS TO SCORE
                    </Text>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                      <Text style={{ color: C.white, fontSize: 12 }}>
                        Yes: {p.markets['Both Teams To Score'].yes.toFixed(1)}%
                      </Text>
                      <Text style={{ color: C.white, fontSize: 12 }}>
                        No: {p.markets['Both Teams To Score'].no.toFixed(1)}%
                      </Text>
                    </View>

                    <Text style={{ color: C.gold, fontSize: 12, fontWeight: '900', marginTop: 13, marginBottom: 10 }}>
                      DOUBLE CHANCE
                    </Text>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                      <Text style={{ color: C.white, fontSize: 12 }}>
                        1X: {p.markets['Double Chance']['1X'].toFixed(1)}%
                      </Text>
                      <Text style={{ color: C.white, fontSize: 12 }}>
                        12: {p.markets['Double Chance']['12'].toFixed(1)}%
                      </Text>
                      <Text style={{ color: C.white, fontSize: 12 }}>
                        X2: {p.markets['Double Chance']['X2'].toFixed(1)}%
                      </Text>
                    </View>
                  </View>
                </View>
              ))}

              <Text style={{
                color: C.muted,
                fontSize: 10,
                lineHeight: 16
              }}>
                Probabilities are model estimates, not guarantees. Current historical sample: 9 matches per team.
              </Text>
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
              Premier League Fixtures
            </Text>
            <Text style={{
              color: C.muted,
              marginBottom: 12
            }}>
              Match times shown in Kenya time (EAT)
            </Text>

            {liveFixtures.map(match => (
              <View key={match.id} style={{
                backgroundColor: C.panel,
                padding: 16,
                borderRadius: 14,
                marginTop: 10
              }}>
                <Text style={{
                  color: C.green,
                  fontSize: 12,
                  fontWeight: '800'
                }}>
                  PREMIER LEAGUE
                </Text>

                <Text style={{
                  color: C.white,
                  fontSize: 17,
                  fontWeight: '900',
                  marginTop: 9
                }}>
                  {match.home}  vs  {match.away}
                </Text>

                <Text style={{
                  color: C.muted,
                  marginTop: 8
                }}>
                  {new Date(match.kickoff).toLocaleString('en-KE', {
                    timeZone: 'Africa/Nairobi',
                    weekday: 'short',
                    day: 'numeric',
                    month: 'short',
                    hour: '2-digit',
                    minute: '2-digit',
                    hour12: true
                  })}
                </Text>

                <Text style={{
                  color: C.gold,
                  fontWeight: '800',
                  marginTop: 7
                }}>
                  {String(match.status).toUpperCase()}
                </Text>

                {match.homeGoals !== null && match.awayGoals !== null && (
                  <Text style={{
                    color: C.white,
                    fontSize: 20,
                    fontWeight: '900',
                    marginTop: 7
                  }}>
                    {match.homeGoals} - {match.awayGoals}
                  </Text>
                )}
              </View>
            ))}
          </>
        )}

        {tab === 'Predictions' && (
          <>
            <Text style={{
              color: C.white,
              fontSize: 23,
              fontWeight: '900',
              marginBottom: 6
            }}>
              SK AI Predictions
            </Text>

            <Text style={{
              color: C.muted,
              fontSize: 12,
              marginBottom: 14
            }}>
              All matches analysed by the SK Poisson Prediction Engine.
            </Text>

            <Pressable
              onPress={refreshPredictions}
              disabled={refreshingPredictions}
              style={{
                backgroundColor: C.green,
                paddingVertical: 12,
                borderRadius: 10,
                alignItems: 'center',
                marginBottom: 14,
                opacity: refreshingPredictions ? 0.6 : 1
              }}
            >
              <Text style={{
                color: C.bg,
                fontSize: 13,
                fontWeight: '900'
              }}>
                {refreshingPredictions ? 'REFRESHING...' : '↻ REFRESH PREDICTIONS'}
              </Text>
            </Pressable>

            <TextInput
              value={predictionSearch}
              onChangeText={setPredictionSearch}
              placeholder="Search by team name..."
              placeholderTextColor={C.muted}
              style={{
                backgroundColor: C.panel,
                color: C.white,
                borderRadius: 10,
                paddingHorizontal: 13,
                paddingVertical: 11,
                marginBottom: 12,
                borderWidth: 1,
                borderColor: '#25405A'
              }}
            />

            <View style={{
              flexDirection: 'row',
              flexWrap: 'wrap',
              gap: 8,
              marginBottom: 14
            }}>
              {['All', '1X2', 'Over/Under', 'BTTS', 'Double Chance'].map(item => (
                <Pressable
                  key={item}
                  onPress={() => setPredictionMarket(item)}
                  style={{
                    backgroundColor: predictionMarket === item ? C.green : C.panel,
                    paddingHorizontal: 12,
                    paddingVertical: 9,
                    borderRadius: 20
                  }}
                >
                  <Text style={{
                    color: predictionMarket === item ? C.bg : C.white,
                    fontSize: 11,
                    fontWeight: '800'
                  }}>
                    {item}
                  </Text>
                </Pressable>
              ))}
            </View>

            <View style={{
              backgroundColor: C.panel,
              borderRadius: 12,
              padding: 13,
              marginBottom: 14
            }}>
              <Text style={{ color: C.green, fontWeight: '900' }}>
                {predictions.length} MATCHES ANALYSED
              </Text>
              <Text style={{ color: C.muted, fontSize: 11, marginTop: 5 }}>
                Probabilities are statistical estimates, not guaranteed outcomes.
              </Text>
            </View>

            {predictions.length === 0 ? (
              <Text style={{ color: C.gold, padding: 15 }}>
                Loading predictions from the backend...
              </Text>
            ) : predictions.filter(p => {
  const q = predictionSearch.trim().toLowerCase();
  return (p.home + ' ' + p.away).toLowerCase().includes(q);
}).map(p => (
              <View key={p.id} style={{
                backgroundColor: C.panel,
                borderRadius: 14,
                padding: 15,
                marginBottom: 13
              }}>
                <Text style={{
                  color: C.white,
                  fontSize: 17,
                  fontWeight: '900'
                }}>
                  {p.home} vs {p.away}
                </Text>

                <Text style={{
                  color: C.muted,
                  fontSize: 11,
                  marginTop: 5,
                  marginBottom: 13
                }}>
                  {new Date(p.kickoff).toLocaleString('en-KE', {
                    timeZone: 'Africa/Nairobi',
                    dateStyle: 'medium',
                    timeStyle: 'short'
                  })} EAT
                </Text>

                {(predictionMarket === 'All' || predictionMarket === '1X2') && (
                  <>
                    <Text style={{ color: C.gold, fontWeight: '900', marginBottom: 9 }}>
                      FULL TIME RESULT (1X2)
                    </Text>

                <View style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between'
                }}>
                  <Text style={{ color: C.green, fontWeight: '900' }}>
                    HOME {p.markets['1X2'].home.toFixed(1)}%
                  </Text>
                  <Text style={{ color: C.gold, fontWeight: '900' }}>
                    DRAW {p.markets['1X2'].draw.toFixed(1)}%
                  </Text>
                  <Text style={{ color: C.green, fontWeight: '900' }}>
                    AWAY {p.markets['1X2'].away.toFixed(1)}%
                  </Text>
                </View>

                    <Text style={{ color: C.muted, fontSize: 12, marginTop: 12 }}>
                      Expected goals: {p.expectedGoals.home.toFixed(2)} - {p.expectedGoals.away.toFixed(2)}
                    </Text>
                  </>
                )}

                <View style={{
                  borderTopWidth: 1,
                  borderTopColor: C.muted,
                  marginTop: 13,
                  paddingTop: 12
                }}>
                  {(predictionMarket === 'All' || predictionMarket === 'Over/Under') && (
                    <>
                      <Text style={{ color: C.gold, fontWeight: '900', marginBottom: 8 }}>
                        OVER / UNDER 2.5 GOALS
                      </Text>
                      <Text style={{ color: C.white, fontSize: 12 }}>
                        Over: {p.markets['Over/Under 2.5'].over.toFixed(1)}%     Under: {p.markets['Over/Under 2.5'].under.toFixed(1)}%
                      </Text>
                    </>
                  )}

                  {(predictionMarket === 'All' || predictionMarket === 'BTTS') && (
                    <>
                      <Text style={{ color: C.gold, fontWeight: '900', marginTop: 13, marginBottom: 8 }}>
                        BOTH TEAMS TO SCORE
                      </Text>
                      <Text style={{ color: C.white, fontSize: 12 }}>
                        Yes: {p.markets['Both Teams To Score'].yes.toFixed(1)}%     No: {p.markets['Both Teams To Score'].no.toFixed(1)}%
                      </Text>
                    </>
                  )}

                  {(predictionMarket === 'All' || predictionMarket === 'Double Chance') && (
                    <>
                      <Text style={{ color: C.gold, fontWeight: '900', marginTop: 13, marginBottom: 8 }}>
                        DOUBLE CHANCE
                      </Text>
                      <Text style={{ color: C.white, fontSize: 12 }}>
                        1X: {p.markets['Double Chance']['1X'].toFixed(1)}%     12: {p.markets['Double Chance']['12'].toFixed(1)}%     X2: {p.markets['Double Chance']['X2'].toFixed(1)}%
                      </Text>
                    </>
                  )}
                </View>
                <Pressable
                  onPress={() => savePrediction(p)}
                  style={{
                    backgroundColor: C.green,
                    paddingVertical: 11,
                    borderRadius: 9,
                    alignItems: "center",
                    marginTop: 14
                  }}
                >
                  <Text style={{ color: C.bg, fontWeight: "900" }}>SAVE TIP</Text>
                </Pressable>
              </View>
            ))}

            <Text style={{
              color: C.muted,
              fontSize: 11,
              lineHeight: 17,
              marginBottom: 15
            }}>
              Model uses a limited historical sample of 9 matches per team. Predictions are estimates, not guarantees. Please make informed decisions.
            </Text>
          </>
        )}

                {tab === 'Saved' && (
          <View style={{ backgroundColor: C.panel, padding: 20, borderRadius: 18 }}>
            <Text style={{ color: C.white, fontSize: 22, fontWeight: '900' }}>
              Saved Tips
            </Text>

            {savedTips.length === 0 ? (
              <Text style={{ color: C.muted, marginTop: 12 }}>
                No saved predictions yet.
              </Text>
            ) : savedTips.map((item: any) => {
              const p = item.tip_data || {};
              const markets = p.markets || {};
              const isExpanded = expandedSavedTip === item.id;

              return (
                <View key={item.id} style={{
                  backgroundColor: C.bg,
                  padding: 14,
                  marginTop: 12,
                  borderRadius: 12
                }}>
                  <Pressable
                    onPress={() => setExpandedSavedTip(isExpanded ? null : item.id)}
                  >
                    <Text style={{ color: C.white, fontWeight: '900', fontSize: 16 }}>
                      {p.home} vs {p.away}
                    </Text>

                    <Text style={{ color: C.muted, marginTop: 8 }}>
                      Kickoff: {p.kickoff || 'Not available'}
                    </Text>

                    <Text style={{ color: C.green, marginTop: 10, fontWeight: '900' }}>
                      {isExpanded ? 'HIDE DETAILS ▲' : 'VIEW FULL PREDICTION ▼'}
                    </Text>
                  </Pressable>

                  {isExpanded && (
                    <View style={{
                      borderTopWidth: 1,
                      borderTopColor: C.muted,
                      marginTop: 14,
                      paddingTop: 14
                    }}>
                      <Text style={{ color: C.gold, fontWeight: "900" }}>
                        PREDICTION MODEL
                      </Text>
                      <Text style={{ color: C.white, marginTop: 8 }}>
                        Model: {p.model || "Not available"}
                      </Text>
                      <Text style={{ color: C.white, marginTop: 5 }}>
                        Historical sample: {p.sample?.homeMatches ?? "N/A"} home matches, {p.sample?.awayMatches ?? "N/A"} away matches
                      </Text>
                      <Text style={{ color: C.muted, marginTop: 5 }}>
                        Data quality: {p.dataQuality || "Not available"}
                      </Text>

                      <Text style={{ color: C.gold, fontWeight: '900' }}>
                        FULL TIME RESULT (1X2)
                      </Text>
                      <Text style={{ color: C.white, marginTop: 8 }}>
                        Home: {markets['1X2']?.home?.toFixed?.(1) ?? 'N/A'}%
                      </Text>
                      <Text style={{ color: C.white }}>
                        Draw: {markets['1X2']?.draw?.toFixed?.(1) ?? 'N/A'}%
                      </Text>
                      <Text style={{ color: C.white }}>
                        Away: {markets['1X2']?.away?.toFixed?.(1) ?? 'N/A'}%
                      </Text>

                      <Text style={{ color: C.muted, marginTop: 10 }}>
                        Expected goals: {p.expectedGoals?.home?.toFixed?.(2) ?? 'N/A'} - {p.expectedGoals?.away?.toFixed?.(2) ?? 'N/A'}
                      </Text>

                      <Text style={{ color: C.gold, fontWeight: '900', marginTop: 14 }}>
                        OVER / UNDER 2.5
                      </Text>
                      <Text style={{ color: C.white, marginTop: 6 }}>
                        Over: {markets['Over/Under 2.5']?.over?.toFixed?.(1) ?? 'N/A'}%
                        {'   '}Under: {markets['Over/Under 2.5']?.under?.toFixed?.(1) ?? 'N/A'}%
                      </Text>

                      <Text style={{ color: C.gold, fontWeight: '900', marginTop: 14 }}>
                        BOTH TEAMS TO SCORE
                      </Text>
                      <Text style={{ color: C.white, marginTop: 6 }}>
                        Yes: {markets['Both Teams To Score']?.yes?.toFixed?.(1) ?? 'N/A'}%
                        {'   '}No: {markets['Both Teams To Score']?.no?.toFixed?.(1) ?? 'N/A'}%
                      </Text>

                      <Text style={{ color: C.gold, fontWeight: '900', marginTop: 14 }}>
                        DOUBLE CHANCE
                      </Text>
                      <Text style={{ color: C.white, marginTop: 6 }}>
                        1X: {markets['Double Chance']?.['1X']?.toFixed?.(1) ?? 'N/A'}%
                        {'   '}12: {markets['Double Chance']?.['12']?.toFixed?.(1) ?? 'N/A'}%
                        {'   '}X2: {markets['Double Chance']?.['X2']?.toFixed?.(1) ?? 'N/A'}%
                      </Text>

                      <Pressable
                        onPress={() => deleteSavedTip(item.id)}
                        style={{
                          backgroundColor: '#B83232',
                          padding: 12,
                          borderRadius: 9,
                          alignItems: 'center',
                          marginTop: 18
                        }}
                      >
                        <Text style={{ color: C.white, fontWeight: '900' }}>
                          DELETE SAVED TIP
                        </Text>
                      </Pressable>
                    </View>
                  )}
                </View>
              );
            })}
          </View>
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

            {authLoading ? (
              <Text style={{ color: C.muted, marginTop: 16 }}>
                Checking your account...
              </Text>
            ) : session ? (
              <>
                <Text style={{
                  color: C.green,
                  fontWeight: '800',
                  marginTop: 16
                }}>
                  YOU ARE SIGNED IN
                </Text>
                <Text style={{
                  color: C.white,
                  marginTop: 8
                }}>
                  {session.user.email}
                </Text>

                <Pressable
                  onPress={handleSignOut}
                  style={{
                    backgroundColor: C.panel2,
                    padding: 15,
                    borderRadius: 10,
                    marginTop: 20,
                    alignItems: 'center'
                  }}
                >
                  <Text style={{ color: C.gold, fontWeight: '900' }}>
                    SIGN OUT
                  </Text>
                </Pressable>
              </>
            ) : (
              <>
                <Text style={{
                  color: C.muted,
                  marginTop: 8
                }}>
                  {authMode === 'login'
                    ? 'Log in to your SK Football Tips account.'
                    : 'Create your SK Football Tips account.'}
                </Text>

                {authMode === 'signup' && (
                  <TextInput
                    value={fullName}
                    onChangeText={setFullName}
                    placeholder="Full name"
                    placeholderTextColor={C.muted}
                    style={inputStyle}
                  />
                )}

                <TextInput
                  value={email}
                  onChangeText={setEmail}
                  placeholder="Email address"
                  placeholderTextColor={C.muted}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  style={inputStyle}
                />

                <TextInput
                  value={password}
                  onChangeText={setPassword}
                  placeholder="Password (at least 6 characters)"
                  placeholderTextColor={C.muted}
                  secureTextEntry
                  autoCapitalize="none"
                  style={inputStyle}
                />

                <Pressable
                  onPress={handleAuth}
                  disabled={authLoading}
                  style={{
                    backgroundColor: C.green,
                    padding: 15,
                    borderRadius: 10,
                    marginTop: 18,
                    alignItems: 'center',
                    opacity: authLoading ? 0.6 : 1
                  }}
                >
                  <Text style={{
                    color: C.bg,
                    fontWeight: '900'
                  }}>
                    {authMode === 'login' ? 'LOG IN' : 'CREATE ACCOUNT'}
                  </Text>
                </Pressable>

                <Pressable
                  onPress={() => {
                    setAuthMode(authMode === 'login' ? 'signup' : 'login');
                    setPassword('');
                  }}
                  style={{ padding: 14, marginTop: 8 }}
                >
                  <Text style={{
                    color: C.green,
                    textAlign: 'center',
                    fontWeight: '800'
                  }}>
                    {authMode === 'login'
                      ? 'New here? Create an account'
                      : 'Already registered? Log in'}
                  </Text>
                </Pressable>
              </>
            )}
          </View>
        )}


      </ScrollView>
      <View style={{
        flexDirection: 'row',
        borderTopWidth: 1,
        borderTopColor: '#1B3045',
        backgroundColor: C.bg
      }}>
        {['Home', 'Fixtures', 'Predictions', 'Saved', 'Premium', 'Admin', 'Profile'].map(button)}
      </View>
    </SafeAreaView>
  );
}
