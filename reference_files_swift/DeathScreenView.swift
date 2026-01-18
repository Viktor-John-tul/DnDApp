import SwiftUI

struct DeathScreenView: View {
    @Bindable var character: RPGCharacter
    
    // Animation State
    @State private var currentDiceValue: Int = 20
    @State private var isRolling: Bool = false
    @State private var showResult: Bool = false
    @State private var message: String? = nil
    @State private var messageColor: Color = .primary
    
    var body: some View {
        ZStack {
            // Dark ominous background overlay
            Color.black.opacity(0.95).edgesIgnoringSafeArea(.all)
            
            VStack(spacing: 30) {
                // Header
                VStack(spacing: 10) {
                    Image(systemName: "exclamationmark.triangle.fill")
                        .font(.system(size: 60))
                        .foregroundStyle(.red)
                        .shadow(color: .red, radius: 10)
                    
                    Text("DEATH SAVES")
                        .font(.largeTitle).bold().fontDesign(.serif)
                        .foregroundStyle(.white)
                        .tracking(2)
                    
                    Text(character.name)
                        .font(.title3).foregroundStyle(.white.opacity(0.7))
                }
                .padding(.top, 40)
                
                // Trackers
                HStack(spacing: 40) {
                    statusColumn(title: "SUCCESSES", count: character.deathSaveSuccesses, icon: "heart.fill", emptyIcon: "heart", activeColor: .green)
                    // FAILURES are now RED HEARTS as requested (filled heart for failure, empty heart outline for space)
                    statusColumn(title: "FAILURES", count: character.deathSaveFailures, icon: "heart.fill", emptyIcon: "heart", activeColor: .red)
                }
                .padding()
                .background(Color.white.opacity(0.1))
                .cornerRadius(20)
                
                Spacer()
                
                // Rolling Area
                if character.deathSaveSuccesses < 3 && character.deathSaveFailures < 3 {
                    VStack(spacing: 20) {
                        ZStack {
                            Image(systemName: "hexagon.fill")
                                .resizable()
                                .aspectRatio(contentMode: .fit)
                                .frame(width: 120, height: 120)
                                .foregroundStyle(isRolling ? .gray : (showResult ? messageColor : .gray))
                                .shadow(color: isRolling ? .clear : (showResult ? messageColor.opacity(0.5) : .clear), radius: 20)
                            
                            Text("\(currentDiceValue)")
                                .font(.system(size: 50, weight: .black, design: .monospaced))
                                .foregroundStyle(.white)
                                .contentTransition(.numericText(value: Double(currentDiceValue)))
                        }
                        .scaleEffect(isRolling ? 1.1 : 1.0)
                        .animation(.easeInOut(duration: 0.1), value: isRolling)
                        
                        if showResult, let msg = message {
                            Text(msg.uppercased())
                                .font(.headline)
                                .bold()
                                .foregroundStyle(messageColor)
                                .transition(.scale.combined(with: .opacity))
                        }
                        
                        Button(action: startRoll) {
                            Text(isRolling ? "Rolling..." : "ROLL D20")
                                .font(.title3).bold()
                                .padding(.horizontal, 40)
                                .padding(.vertical, 16)
                                .background(isRolling ? Color.gray : Color.white)
                                .foregroundStyle(.black)
                                .cornerRadius(30)
                                .shadow(radius: 10)
                        }
                        .disabled(isRolling)
                    }
                } else {
                    // Final State
                    VStack(spacing: 20) {
                        if character.deathSaveSuccesses >= 3 {
                            resultCard(title: "STABILIZED", icon: "heart.circle.fill", color: .green, desc: "You are stable but unconscious.")
                            Button("Regain Consciousness (1 HP)") { resolve(hp: 1) }
                                .buttonStyle(.borderedProminent).tint(.green)
                        } else {
                            // Using skull icon for final death result card, but hearts for counter as requested
                            resultCard(title: "DECEASED", icon: "skull.circle.fill", color: .red, desc: "Your character has died.")
                            Button("Revive (Reset)") { resolve(hp: 1) }
                                .buttonStyle(.bordered).tint(.red)
                        }
                    }
                    .transition(.move(edge: .bottom))
                }
                
                Spacer()
                
                // Emergency Action
                Button(action: { resolve(hp: Int.random(in: 1...4) + 4) }) { // 1d4 + 4(potion)
                    HStack {
                        Image(systemName: "cross.fill")
                        Text("Administer Potion (Heal)").bold()
                    }
                    .font(.caption)
                    .padding(10)
                    .background(Color.white.opacity(0.15))
                    .foregroundStyle(.white.opacity(0.8))
                    .cornerRadius(20)
                }
                .padding(.bottom, 20)
            }
            .padding()
        }
    }
    
    // MARK: - Components
    
    func statusColumn(title: String, count: Int, icon: String, emptyIcon: String, activeColor: Color) -> some View {
        VStack(spacing: 15) {
            Text(title)
                .font(.caption).bold().foregroundStyle(.white.opacity(0.6))
                .tracking(1)
            
            HStack(spacing: 8) {
                ForEach(0..<3) { index in
                    Image(systemName: index < count ? icon : emptyIcon)
                        .font(.title2)
                        .foregroundStyle(index < count ? activeColor : .gray.opacity(0.3))
                        .shadow(color: index < count ? activeColor.opacity(0.6) : .clear, radius: 5)
                        .scaleEffect(index < count ? 1.1 : 1.0)
                        .animation(.spring(response: 0.4, dampingFraction: 0.6), value: count)
                }
            }
        }
    }
    
    func resultCard(title: String, icon: String, color: Color, desc: String) -> some View {
        VStack(spacing: 15) {
            Image(systemName: icon)
                .font(.system(size: 80))
                .foregroundStyle(color)
                .shadow(color: color.opacity(0.6), radius: 20)
            
            Text(title)
                .font(.largeTitle).bold().foregroundStyle(color)
            
            Text(desc)
                .foregroundStyle(.gray)
        }
        .padding(30)
        .background(Color(UIColor.secondarySystemGroupedBackground))
        .cornerRadius(20)
        .shadow(radius: 20)
    }
    
    // MARK: - Logic
    
    func resolve(hp: Int) {
        withAnimation {
            character.currentHP = hp
            character.deathSaveSuccesses = 0
            character.deathSaveFailures = 0
            // View should close automatically as currentHP > 0
        }
    }
    
    func startRoll() {
        isRolling = true
        showResult = false
        message = nil
        
        let duration = 1.0
        let steps = 15
        
        // Animation Loop
        for i in 0..<steps {
            DispatchQueue.main.asyncAfter(deadline: .now() + (Double(i) * (duration / Double(steps)))) {
                currentDiceValue = Int.random(in: 1...20)
                UIImpactFeedbackGenerator(style: .light).impactOccurred()
            }
        }
        
        // Final Result
        DispatchQueue.main.asyncAfter(deadline: .now() + duration) {
            finalizeRoll()
        }
    }
    
    func finalizeRoll() {
        let roll = Int.random(in: 1...20)
        currentDiceValue = roll
        isRolling = false
        showResult = true
        UIImpactFeedbackGenerator(style: .heavy).impactOccurred()
        
        withAnimation(.spring()) {
            processResult(roll)
        }
    }
    
    func processResult(_ roll: Int) {
        if roll == 20 {
            character.deathSaveSuccesses += 2
            message = "CRITICAL SUCCESS!"
            messageColor = .green
        } else if roll == 1 {
            character.deathSaveFailures += 2
            message = "CRITICAL FAILURE!"
            messageColor = .red
        } else if roll >= 10 {
            character.deathSaveSuccesses += 1
            message = "SUCCESS"
            messageColor = .green
        } else {
            character.deathSaveFailures += 1
            message = "FAILURE"
            messageColor = .red
        }
    }
}
