import SwiftUI

// Combined dice roller that supports mixed dice in one UI (with scrolling for large dice counts)
struct CombinedDiceGroup: Identifiable {
    let id = UUID()
    let label: String
    let count: Int
    let face: Int
}

struct CombinedDiceRollerView: View {
    let title: String
    let groups: [CombinedDiceGroup]
    let modifier: Int
    let onDismiss: (Int) -> Void
    
    @State private var results: [[Int]] = []
    @State private var isRolling = true
    @State private var showResult = false
    
    var subtotalPerGroup: [Int] { results.map { $0.reduce(0, +) } }
    var total: Int { subtotalPerGroup.reduce(0, +) + modifier }
    
    let columns = [GridItem(.adaptive(minimum: 35, maximum: 45), spacing: 4)]

    var body: some View {
        ZStack {
            Color.black.opacity(0.7).ignoresSafeArea()
                .onTapGesture { if showResult { onDismiss(total) } }
            
            VStack(spacing: 16) {
                Text(title.uppercased()).font(.headline).foregroundStyle(.gray).padding(.top)
                
                ScrollView {
                    VStack(alignment: .leading, spacing: 16) {
                        ForEach(groups.indices, id: \.self) { index in
                            let grp = groups[index]
                            let rowCount = (results.indices.contains(index) ? results[index].count : grp.count)
                            let subtotal = (results.indices.contains(index) ? results[index].reduce(0, +) : 0)
                            
                            VStack(alignment: .leading, spacing: 6) {
                                HStack {
                                    Text(grp.label).font(.caption).bold().foregroundStyle(.secondary)
                                    Spacer()
                                    if showResult {
                                        Text("= \(subtotal)").font(.caption).bold().foregroundStyle(.primary)
                                            .padding(.horizontal, 6).padding(.vertical, 2)
                                            .background(Color.gray.opacity(0.1)).cornerRadius(4)
                                    }
                                }
                                
                                LazyVGrid(columns: columns, spacing: 6) {
                                    ForEach(0..<rowCount, id: \.self) { dieIdx in
                                        let face = grp.face
                                        let value = (results.indices.contains(index) && results[index].indices.contains(dieIdx)) ? results[index][dieIdx] : 1
                                        ZStack {
                                            Image(systemName: getDieIcon(face: face))
                                                .resizable().aspectRatio(contentMode: .fit)
                                                .frame(width: 30, height: 30)
                                                .foregroundStyle(isRolling ? .gray : .blue)
                                            Text("\(value)").font(.system(size: 14, weight: .black)).foregroundStyle(.white)
                                        }
                                    }
                                }
                            }
                            .padding(10).background(Color(UIColor.secondarySystemBackground)).cornerRadius(10)
                        }
                    }
                    .padding(.horizontal)
                }
                .frame(maxHeight: 400)
                
                if showResult {
                    HStack(spacing: 12) {
                        if modifier != 0 {
                            VStack(spacing: 0) {
                                Text("MOD").font(.system(size: 10)).bold().foregroundStyle(.secondary)
                                Text("\(modifier > 0 ? "+" : "")\(modifier)").font(.title3).bold()
                            }
                        }
                        Text("=").font(.title2).foregroundStyle(.secondary)
                        VStack(spacing: 0) {
                            Text("TOTAL").font(.system(size: 10)).bold().foregroundStyle(.secondary)
                            Text("\(total)").font(.largeTitle).bold()
                        }
                    }
                    .padding(.vertical, 4)
                } else {
                    Text("Rolling...").font(.subheadline).italic().foregroundStyle(.secondary).frame(height: 40)
                }
                
                Button("Close") { onDismiss(total) }
                    .buttonStyle(.borderedProminent)
                    .padding(.bottom, 12)
            }
            .padding(.vertical, 16)
            .background(Color(UIColor.systemBackground))
            .cornerRadius(20)
            .shadow(radius: 20)
            .padding(24)
        }
        .onAppear {
            results = groups.map { Array(repeating: 1, count: $0.count) }
            rollAll()
        }
    }
    
    func getDieIcon(face: Int) -> String {
        switch face {
        case 20: return "hexagon.fill"
        case 8: return "diamond.fill"
        case 4: return "triangle.fill"
        default: return "square.fill"
        }
    }
    
    func rollAll() {
        let duration = 1.0
        for i in 0..<10 {
            DispatchQueue.main.asyncAfter(deadline: .now() + (Double(i) * 0.1)) {
                UIImpactFeedbackGenerator(style: .light).impactOccurred()
                for gIdx in 0..<groups.count {
                    for dIdx in 0..<groups[gIdx].count {
                        results[gIdx][dIdx] = Int.random(in: 1...groups[gIdx].face)
                    }
                }
            }
        }
        DispatchQueue.main.asyncAfter(deadline: .now() + duration) {
            UIImpactFeedbackGenerator(style: .heavy).impactOccurred()
            isRolling = false
            for gIdx in 0..<groups.count {
                for dIdx in 0..<groups[gIdx].count {
                    results[gIdx][dIdx] = Int.random(in: 1...groups[gIdx].face)
                }
            }
            withAnimation { showResult = true }
        }
    }
}

// Safe subscripting helpers
extension Array {
    subscript(safe index: Int) -> Element? { indices.contains(index) ? self[index] : nil }
}

struct DiceRollerView: View {
    let title: String
    let diceCount: Int
    let diceFace: Int
    let modifier: Int
    let rollMode: RollMode
    let onDismiss: (Int) -> Void
    
    @State private var individualResults: [Int] = []
    @State private var isRolling = true
    @State private var showResult = false
    
    let columns = [GridItem(.adaptive(minimum: 60, maximum: 80), spacing: 12)]

    var resultValue: Int {
        if rollMode == .normal {
            return individualResults.reduce(0, +)
        } else if rollMode == .disadvantage {
            return individualResults.min() ?? 0
        } else {
            return individualResults.max() ?? 0
        }
    }
    
    var finalTotal: Int { resultValue + modifier }
    
    var body: some View {
        ZStack {
            Color.black.opacity(0.7).ignoresSafeArea()
                .onTapGesture { if showResult { onDismiss(finalTotal) } }
            
            VStack(spacing: 25) {
                VStack(spacing: 5) {
                    Text(title.uppercased()).font(.headline).foregroundStyle(.gray)
                    if rollMode == .disadvantage {
                        Text("DISADVANTAGE").font(.caption).bold().foregroundStyle(.red)
                            .padding(4).background(Color.red.opacity(0.1)).cornerRadius(4)
                    }
                    if rollMode == .advantage {
                        Text("ADVANTAGE").font(.caption).bold().foregroundStyle(.green)
                            .padding(4).background(Color.green.opacity(0.1)).cornerRadius(4)
                    }
                }
                .padding(.top)
                
                // --- DICE ROW (Grid for many, HStack for few) ---
                if individualResults.count <= 4 {
                    HStack(spacing: 15) {
                        ForEach(0..<individualResults.count, id: \.self) { index in
                            dieView(for: index)
                        }
                    }
                    .padding(.horizontal)
                } else {
                    LazyVGrid(columns: columns, spacing: 12) {
                        ForEach(0..<individualResults.count, id: \.self) { index in
                            dieView(for: index)
                        }
                    }
                    .padding(.horizontal)
                    .frame(maxHeight: 300)
                }
                
                // --- MATH SECTION ---
                if showResult {
                    HStack(spacing: 15) {
                        VStack {
                            Text("KEPT").font(.caption).bold().foregroundStyle(.secondary)
                            Text("\(resultValue)").font(.title2).bold()
                        }
                        if modifier != 0 {
                            Image(systemName: modifier > 0 ? "plus" : "minus").font(.caption).foregroundStyle(.secondary)
                            VStack {
                                Text("MOD").font(.caption).bold().foregroundStyle(.secondary)
                                Text("\(abs(modifier))").font(.title2).bold()
                            }
                        }
                        Image(systemName: "equal").font(.title2).foregroundStyle(.secondary)
                        VStack {
                            Text("TOTAL").font(.caption).bold().foregroundStyle(.secondary)
                            Text("\(finalTotal)").font(.largeTitle).bold()
                        }
                    }
                    .transition(.move(edge: .bottom).combined(with: .opacity)).padding(.top, 10)
                } else {
                    Text("Rolling...").font(.title3).italic().foregroundStyle(.secondary).frame(height: 60)
                }
                
                Button("Close") { onDismiss(finalTotal) }.padding(.bottom, 10)
            }
            .padding(30).background(Color(UIColor.systemBackground)).cornerRadius(20).shadow(radius: 20).padding(20)
        }
        .onAppear {
            let count = (rollMode == .normal) ? diceCount : 2
            individualResults = Array(repeating: 1, count: count)
            rollDice()
        }
    }
    
    func getDieIcon(face: Int) -> String {
        face == 20 ? "hexagon.fill" : (face == 8 ? "diamond.fill" : "square.fill")
    }
    
    @ViewBuilder
    func dieView(for index: Int) -> some View {
        let value = individualResults[index]
        let isDropped = showResult && rollMode != .normal && (
            (rollMode == .disadvantage && value != resultValue) ||
            (rollMode == .advantage && value != resultValue)
        )
        let actualDropped = isDropped && (index == 1 || individualResults[0] != individualResults[1])
        
        ZStack {
            Image(systemName: getDieIcon(face: diceFace))
                .resizable().aspectRatio(contentMode: .fit)
                .frame(width: 60, height: 60)
                .foregroundStyle(
                    isRolling ? .gray :
                    (actualDropped ? .gray.opacity(0.3) :
                     (diceFace == 20 && value == 1 ? .red :
                      diceFace == 20 && value == 20 ? .green : .blue))
                )
            Text("\(value)")
                .font(.system(size: 24, weight: .black))
                .foregroundStyle(actualDropped ? .white.opacity(0.5) : .white)
                .contentTransition(.numericText(value: Double(value)))
            
            if actualDropped {
                Image(systemName: "xmark").font(.title).foregroundStyle(.red.opacity(0.7))
            }
        }
        .scaleEffect(isRolling ? 0.9 : 1.0)
    }
    
    func rollDice() {
        let count = (rollMode == .normal) ? diceCount : 2
        let duration = 1.0
        for i in 0..<10 {
            DispatchQueue.main.asyncAfter(deadline: .now() + (Double(i) * 0.1)) {
                UIImpactFeedbackGenerator(style: .light).impactOccurred()
                for idx in 0..<count { individualResults[idx] = Int.random(in: 1...diceFace) }
            }
        }
        DispatchQueue.main.asyncAfter(deadline: .now() + duration) {
            UIImpactFeedbackGenerator(style: .heavy).impactOccurred()
            isRolling = false
            for idx in 0..<count { individualResults[idx] = Int.random(in: 1...diceFace) }
            withAnimation { showResult = true }
        }
    }
}
